import csv
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

from rsvp_viewer import FORMATS, RSVPViewer, export_rows, fetch_responses, filter_rows, totals


class ViewerTests(unittest.TestCase):
    def setUp(self):
        self.rows = [
            dict(id='1', full_name='José & Ana', contact='+639123456789', attendance='accepts', guests=3, message='<script>alert(1)</script>\nHello', created_at='2026-09-10T10:00:00Z'),
            dict(id='2', full_name='=1+1', contact='guest@example.com', attendance='declines', guests=2, message='Sorry, cannot come', created_at='2026-09-10T09:00:00Z'),
        ]

    def test_totals_and_filters(self):
        self.assertEqual(totals(self.rows), (2, 1, 1, 3))
        self.assertEqual(totals([]), (0, 0, 0, 0))
        self.assertEqual(filter_rows(self.rows, 'JOSÉ', 'Accepted'), self.rows[:1])
        self.assertEqual(filter_rows(self.rows, 'cannot', 'Declined'), self.rows[1:])

    def test_all_exports(self):
        with tempfile.TemporaryDirectory() as folder:
            for fmt in FORMATS:
                path = Path(folder) / ('report.' + fmt.lower())
                export_rows(path, self.rows, fmt)
                self.assertGreater(path.stat().st_size, 0)
            self.assertEqual(json.loads((Path(folder) / 'report.json').read_text(encoding='utf-8')), self.rows)
            self.assertEqual(len(ET.parse(Path(folder) / 'report.xml').getroot()), 2)
            report = (Path(folder) / 'report.html').read_text(encoding='utf-8')
            self.assertNotIn('<script>', report)
            self.assertIn('&lt;script&gt;', report)
            with (Path(folder) / 'report.csv').open(encoding='utf-8-sig', newline='') as file:
                data = list(csv.reader(file))
            self.assertEqual(data[2][1], "'=1+1")
            self.assertEqual(data[1][5], self.rows[0]['message'])

    def test_pagination_even_when_server_caps_pages(self):
        pages = [io.StringIO(json.dumps([row])) for row in self.rows] + [io.StringIO('[]')]
        with patch('rsvp_viewer.urlopen', side_effect=pages) as request:
            self.assertEqual(fetch_responses('https://example.supabase.co', 'sb_secret_test'), self.rows)
        self.assertIn('offset=1', request.call_args_list[1].args[0].full_url)
        self.assertNotIn('Authorization', request.call_args_list[0].args[0].headers)

    def test_reject_public_key_and_insecure_url(self):
        with self.assertRaises(ValueError):
            fetch_responses('https://example.supabase.co', 'sb_publishable_test')
        with self.assertRaises(ValueError):
            fetch_responses('http://example.supabase.co', 'sb_secret_test')

    def test_dashboard_smoke(self):
        app = RSVPViewer()
        app.withdraw()
        try:
            app.rows = self.rows
            app.render()
            self.assertEqual(len(app.tree.get_children()), 2)
            app.attendance.set('Accepted')
            self.assertEqual(len(app.tree.get_children()), 1)
        finally:
            app.destroy()


if __name__ == '__main__':
    unittest.main()
