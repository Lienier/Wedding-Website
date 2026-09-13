@echo off
cd /d "%~dp0"
python rsvp_viewer.py
if errorlevel 1 pause
