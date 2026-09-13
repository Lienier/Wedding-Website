"""Local RSVP dashboard. Run with: python rsvp_viewer.py (no dependencies)."""
import csv
import html
import json
import os
from pathlib import Path
import queue
import re
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlencode
import xml.etree.ElementTree as ET

FIELDS = ('id', 'full_name', 'contact', 'attendance', 'guests', 'message', 'created_at')
LABELS = ('Response ID', 'Full name', 'Contact', 'Attendance', 'Guests', 'Message', 'Submitted at')
FORMATS = ('CSV', 'TSV', 'JSON', 'HTML', 'XML', 'TXT')


def project_url():
    config = Path(__file__).with_name('supabase-config.js')
    match = re.search(r'window\.SUPABASE_URL\s*=\s*[\"\']([^\"\']+)', config.read_text(encoding='utf-8')) if config.exists() else None
    return os.getenv('SUPABASE_URL', match[1] if match else '')


def fetch_responses(url, key):
    """Read all pages; never mutate the RSVP table or persist credentials."""
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Enter the HTTPS project URL, without a path or query.')
    if not key or key.startswith('sb_publishable_'):
        raise ValueError('Enter a Supabase secret key or legacy service-role key, not the public website key.')
    if not key.startswith('sb_secret_'):
        import base64
        try:
            payload = key.split('.')[1]
            role = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4))).get('role')
        except (ValueError, IndexError, UnicodeError):
            role = None
        if role != 'service_role':
            raise ValueError('This viewer requires a secret key or legacy service-role key.')
    headers = {'apikey': key, 'Accept': 'application/json'}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    rows = []
    while True:
        query = urlencode({'select': ','.join(FIELDS), 'order': 'created_at.desc,id.desc', 'limit': 500, 'offset': len(rows)})
        request = Request(url.rstrip('/') + '/rest/v1/rsvps?' + query, headers=headers)
        try:
            with urlopen(request, timeout=30) as response:
                page = json.load(response)
        except HTTPError as error:
            raise RuntimeError(f'Supabase returned HTTP {error.code}. Check your project URL, admin key, and rsvps table access.') from None
        except URLError:
            raise RuntimeError('Could not reach Supabase. Check your internet connection and project URL.') from None
        if not isinstance(page, list):
            raise ValueError('Supabase returned an unexpected response.')
        if not page:
            break
        rows.extend(page)
    return rows


def totals(rows):
    accepted = [r for r in rows if r.get('attendance') == 'accepts']
    return len(rows), len(accepted), sum(r.get('attendance') == 'declines' for r in rows), sum(int(r.get('guests') or 0) for r in accepted)


def filter_rows(rows, search='', attendance='All responses'):
    term = search.casefold().strip()
    status = {'Accepted': 'accepts', 'Declined': 'declines'}.get(attendance)
    return [r for r in rows if (not status or r.get('attendance') == status) and (not term or term in ' '.join(str(r.get(f, '')) for f in FIELDS).casefold())]


def export_rows(path, rows, fmt):
    path = Path(path)
    records = [{f: r.get(f, '') for f in FIELDS} for r in rows]
    if fmt in ('CSV', 'TSV'):
        # Prevent user-entered names/messages from becoming spreadsheet formulas.
        def safe(value):
            return "'" + value if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r', '\n')) else value
        with path.open('w', encoding='utf-8-sig', newline='') as file:
            writer = csv.writer(file, delimiter=',' if fmt == 'CSV' else '\t')
            writer.writerow(LABELS)
            writer.writerows([safe(r[f]) for f in FIELDS] for r in records)
    elif fmt == 'JSON':
        path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    elif fmt == 'XML':
        root = ET.Element('rsvps', count=str(len(records)))
        for record in records:
            element = ET.SubElement(root, 'response')
            for field, value in record.items():
                ET.SubElement(element, field).text = str(value if value is not None else '')
        ET.indent(root)
        ET.ElementTree(root).write(path, encoding='utf-8', xml_declaration=True)
    elif fmt == 'HTML':
        counts = totals(records)
        body = ''.join('<tr>' + ''.join('<td>' + html.escape(str(r[f])) + '</td>' for f in FIELDS) + '</tr>' for r in records)
        path.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wedding RSVP report</title><style>body{font:14px system-ui;margin:40px;color:#23314b}h1{font-family:Georgia}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:12px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#eef2fa}button{padding:10px}@media print{button{display:none}body{margin:0}table{font-size:9px}}</style><h1>Philip &amp; Ednalyn — RSVP report</h1>' + f'<p>{counts[0]} responses · {counts[1]} accepted · {counts[2]} declined · {counts[3]} attending guests</p>' + '<button onclick="window.print()">Print / Save as PDF</button><table><thead><tr>' + ''.join('<th>' + x + '</th>' for x in LABELS) + '</tr></thead><tbody>' + body + '</tbody></table></html>', encoding='utf-8')
    elif fmt == 'TXT':
        path.write_text('PHILIP & EDNALYN — RSVP REPORT\n\n' + '\n\n'.join('\n'.join(f'{label}: {r[field]}' for field, label in zip(FIELDS, LABELS)) for r in records), encoding='utf-8')
    else:
        raise ValueError('Unsupported export format.')


class RSVPViewer(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Philip & Ednalyn | RSVP Viewer')
        self.geometry('1180x780')
        self.minsize(860, 620)
        self.configure(bg='#f4f6fb')
        self.rows, self.visible = [], []
        self.events = queue.Queue()
        self.url = tk.StringVar(value=project_url())
        self.key = tk.StringVar(value=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY', ''))
        self.search = tk.StringVar()
        self.attendance = tk.StringVar(value='All responses')
        self.format = tk.StringVar(value='CSV')
        self.scope = tk.StringVar(value='All responses')
        self.status = tk.StringVar(value='Connect to Supabase to load your responses.')
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure('.', font=('Segoe UI', 10), background='#f4f6fb', foreground='#24324b')
        style.configure('TButton', padding=(14, 8))
        style.configure('Accent.TButton', background='#304fa0', foreground='white')
        style.map('Accent.TButton', background=[('active', '#233e84')])
        style.configure('TEntry', padding=7, fieldbackground='white')
        style.configure('Treeview', rowheight=36, background='white', fieldbackground='white', borderwidth=0)
        style.configure('Treeview.Heading', padding=10, font=('Segoe UI', 10, 'bold'), background='#e8edf7')
        main = ttk.Frame(self, padding=26)
        main.pack(fill='both', expand=True)
        ttk.Label(main, text='P & E  /  OCTOBER 17, 2026', foreground='#304fa0', font=('Segoe UI', 10, 'bold')).pack(anchor='w')
        ttk.Label(main, text='Your RSVP guestbook', font=('Georgia', 29)).pack(anchor='w', pady=(7, 4))
        ttk.Label(main, text='Every reply, in one place. Plan your celebration with a clear view of your guests.', foreground='#68758a').pack(anchor='w', pady=(0, 20))
        connection = ttk.LabelFrame(main, text=' Private Supabase connection ', padding=12)
        connection.pack(fill='x')
        connection.columnconfigure(0, weight=1)
        connection.columnconfigure(1, weight=1)
        ttk.Label(connection, text='Project URL').grid(row=0, column=0, sticky='w')
        ttk.Label(connection, text='Secret / service-role key (kept in memory only)').grid(row=0, column=1, sticky='w', padx=12)
        ttk.Entry(connection, textvariable=self.url).grid(row=1, column=0, sticky='ew')
        ttk.Entry(connection, textvariable=self.key, show='*').grid(row=1, column=1, sticky='ew', padx=12)
        self.refresh = ttk.Button(connection, text='Connect / Refresh', style='Accent.TButton', command=self.load)
        self.refresh.grid(row=1, column=2)
        cards = ttk.Frame(main)
        cards.pack(fill='x', pady=20)
        self.counts = []
        for index, label in enumerate(('TOTAL RESPONSES', 'ACCEPTED', 'DECLINED', 'ATTENDING GUESTS')):
            cards.columnconfigure(index, weight=1)
            card = tk.Frame(cards, bg='white', padx=18, pady=13)
            card.grid(row=0, column=index, sticky='ew', padx=(0, 12 if index < 3 else 0))
            value = tk.StringVar(value='—')
            self.counts.append(value)
            tk.Label(card, textvariable=value, bg='white', fg='#304fa0', font=('Segoe UI', 27, 'bold')).pack(anchor='w')
            tk.Label(card, text=label, bg='white', fg='#68758a', font=('Segoe UI', 9)).pack(anchor='w')
        filters = ttk.Frame(main)
        filters.pack(fill='x', pady=(0, 12))
        ttk.Label(filters, text='Search').pack(side='left', padx=(0, 8))
        ttk.Entry(filters, textvariable=self.search, width=28).pack(side='left', fill='x', expand=True)
        ttk.Combobox(filters, textvariable=self.attendance, values=('All responses', 'Accepted', 'Declined'), state='readonly', width=18).pack(side='left', padx=12)
        ttk.Button(filters, text='View full response', command=self.detail).pack(side='right')
        table = ttk.Frame(main)
        table.pack(fill='both', expand=True)
        table.rowconfigure(0, weight=1)
        table.columnconfigure(0, weight=1)
        self.tree = ttk.Treeview(table, columns=FIELDS[1:], show='headings', selectmode='browse')
        for field, label, width in zip(FIELDS[1:], LABELS[1:], (180, 190, 105, 65, 240, 185)):
            self.tree.heading(field, text=label)
            self.tree.column(field, width=width, minwidth=60)
        self.tree.tag_configure('odd', background='#f5f7fc')
        self.tree.grid(row=0, column=0, sticky='nsew')
        vertical = ttk.Scrollbar(table, orient='vertical', command=self.tree.yview)
        vertical.grid(row=0, column=1, sticky='ns')
        horizontal = ttk.Scrollbar(table, orient='horizontal', command=self.tree.xview)
        horizontal.grid(row=1, column=0, sticky='ew')
        self.tree.configure(yscrollcommand=vertical.set, xscrollcommand=horizontal.set)
        self.tree.bind('<Double-1>', lambda event: self.detail())
        self.tree.bind('<Return>', lambda event: self.detail())
        bottom = ttk.Frame(main)
        bottom.pack(fill='x', pady=(15, 0))
        ttk.Label(bottom, text='Export').pack(side='left', padx=(0, 8))
        ttk.Combobox(bottom, textvariable=self.scope, values=('All responses', 'Filtered responses'), state='readonly', width=19).pack(side='left')
        ttk.Combobox(bottom, textvariable=self.format, values=FORMATS, state='readonly', width=8).pack(side='left', padx=8)
        ttk.Button(bottom, text='Save report', command=self.export, style='Accent.TButton').pack(side='left')
        ttk.Label(main, textvariable=self.status, foreground='#68758a', wraplength=1000).pack(anchor='w', pady=(12, 0))
        self.search.trace_add('write', lambda *args: self.render())
        self.attendance.trace_add('write', lambda *args: self.render())
        self.after(100, self.poll)

    def load(self):
        url, key = self.url.get().strip(), self.key.get().strip()
        self.refresh.configure(state='disabled')
        self.status.set('Loading all response pages…')
        def worker():
            try:
                self.events.put(('loaded', fetch_responses(url, key)))
            except Exception as error:
                self.events.put(('error', str(error)))
        threading.Thread(target=worker, daemon=True).start()

    def poll(self):
        try:
            kind, value = self.events.get_nowait()
            self.refresh.configure(state='normal')
            if kind == 'loaded':
                self.rows = value
                for variable, count in zip(self.counts, totals(value)):
                    variable.set(str(count))
                self.render()
            else:
                self.status.set('Refresh failed. Previously loaded responses remain visible.')
                messagebox.showerror('Unable to load responses', value, parent=self)
        except queue.Empty:
            pass
        self.after(100, self.poll)

    def render(self):
        self.visible = filter_rows(self.rows, self.search.get(), self.attendance.get())
        self.tree.delete(*self.tree.get_children())
        for i, row in enumerate(self.visible):
            values = [str(row.get(f) or '') for f in FIELDS[1:]]
            values[2] = {'accepts': 'Accepted', 'declines': 'Declined'}.get(values[2], values[2])
            self.tree.insert('', 'end', iid=str(i), values=values, tags=('odd',) if i % 2 else ())
        self.status.set(f'Showing {len(self.visible)} of {len(self.rows)} responses. Totals cover all loaded responses; attending guests excludes declined replies.' if self.rows else 'No responses to display. Connect or refresh to load RSVPs.')

    def detail(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showinfo('Response details', 'Select a response first.', parent=self)
            return
        row = self.visible[int(selected[0])]
        popup = tk.Toplevel(self)
        popup.title('Response details')
        popup.geometry('640x520')
        text = tk.Text(popup, wrap='word', padx=24, pady=24, font=('Segoe UI', 11), relief='flat')
        scroll = ttk.Scrollbar(popup, command=text.yview)
        scroll.pack(side='right', fill='y')
        text.configure(yscrollcommand=scroll.set)
        text.pack(fill='both', expand=True)
        text.insert('1.0', '\n\n'.join(f'{label}\n{row.get(field) or "—"}' for field, label in zip(FIELDS, LABELS)))
        text.configure(state='disabled')

    def export(self):
        rows = self.rows if self.scope.get() == 'All responses' else self.visible
        if not rows:
            messagebox.showinfo('Nothing to export', 'Load responses or adjust your filter first.', parent=self)
            return
        fmt = self.format.get()
        path = filedialog.asksaveasfilename(parent=self, title='Save RSVP report', initialfile='wedding-rsvps.' + fmt.lower(), defaultextension='.' + fmt.lower(), filetypes=[(fmt + ' report', '*.' + fmt.lower())])
        if path:
            try:
                export_rows(path, rows, fmt)
            except (OSError, ValueError) as error:
                messagebox.showerror('Export failed', str(error), parent=self)
                return
            self.status.set(f'Exported {len(rows)} responses to {path}' + (' — Open in a browser to print or save as PDF.' if fmt == 'HTML' else ''))


if __name__ == '__main__':
    RSVPViewer().mainloop()
