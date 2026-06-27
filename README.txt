════════════════════════════════════════════════════════════════════════════

                          ⚡  SPU LOG ANALYZER  ⚡
                  Fault Analysis & Reporting Tool — v2.0

════════════════════════════════════════════════════════════════════════════

WHAT IS THIS?
─────────────
SPU Log Analyzer reads raw or pre-cleaned SPU (Signalling Processing Unit)
log files, automatically cleans and normalises the data, lets you filter
by a specific time window, and produces two structured Excel reports:
a filtered data export and a full colour-coded fault analysis report
with an alarm drill-down tree, hyperlinks, and class-based highlighting.


════════════════════════════════════════════════════════════════════════════
 QUICK START — 3 STEPS
════════════════════════════════════════════════════════════════════════════

  STEP 1.  Double-click  "Install_and_Run.bat"

           This single click does everything automatically:
             • Checks if Python is already on your computer
             • If not, downloads and installs Python silently
               (no questions asked, no extra clicks needed)
             • Installs the required packages (pandas, openpyxl, chardet)
             • Launches the SPU Log Analyzer application

           The first run takes 2–5 minutes depending on your internet
           speed (only if Python needs to be installed). After that,
           it's instant.

  STEP 2.  The SPU Log Analyzer window will open automatically.
           Browse to your log file (.csv or .xlsx), pick a time range,
           and click "Generate Reports".

  STEP 3.  Next time you want to use the tool, just double-click
           "Launch.bat" instead — it skips the installation checks
           and opens the app directly.

  That's it. No technical knowledge required.


════════════════════════════════════════════════════════════════════════════
 FOLDER CONTENTS
════════════════════════════════════════════════════════════════════════════

  spu_log_analysis_tool_adarsh/
  │
  ├── Install_and_Run.bat      ← DOUBLE-CLICK THIS FIRST TIME
  │                              Installs Python + packages, then launches
  │                              the app. Safe to run again any time —
  │                              it will skip steps that are already done.
  │
  ├── Launch.bat                ← Use this for all future launches
  │                              Quick-start the app without re-checking
  │                              installation (much faster).
  │
  ├── README.txt                ← You are here
  │
  ├── install_log.txt           ← Created automatically after first run.
  │                              Contains a log of what was installed,
  │                              useful for troubleshooting.
  │
  ├── app/
  │   └── spu_log_analyzer.py   ← The application itself (do not move
  │                                or rename this file or folder)
  │
  └── build_exe/                ← For advanced users: turn this into a
      ├── spu_analyzer.spec        TRUE standalone .exe that doesn't need
      ├── version_info.txt         Python installed at all on the target
      ├── Build_EXE.bat             machine. See BUILD_INSTRUCTIONS.txt
      └── BUILD_INSTRUCTIONS.txt    inside that folder for details.


════════════════════════════════════════════════════════════════════════════
 TWO WAYS TO RUN THIS TOOL
════════════════════════════════════════════════════════════════════════════

  OPTION A — Install_and_Run.bat  (what most people should use)
  ────────────────────────────────────────────────────────────
  Works on any Windows PC, even ones that have never had Python
  installed before. The first run installs everything automatically.
  Requires an internet connection only for that first-time setup.

  Best for: getting started quickly, sharing with colleagues who
  don't have Python, systems where you have permission to install
  software.


  OPTION B — Build a standalone .exe  (build_exe folder)
  ────────────────────────────────────────────────────────────
  For advanced users who want ONE .exe file that runs on any Windows
  machine with absolutely nothing pre-installed — no Python, no
  internet connection needed at all on the machine that runs it.

  This requires you to "build" the exe once on a machine that DOES
  have Python (using the provided Build_EXE.bat script), but after
  that, the resulting .exe file is fully self-contained and can be
  copied anywhere — USB drives, offline machines, shared folders.

  Best for: distributing to many people, machines with restricted
  internet access or no admin rights to install Python, or simply
  wanting the cleanest "just double-click and go" experience.

  See build_exe\BUILD_INSTRUCTIONS.txt for full step-by-step details.


════════════════════════════════════════════════════════════════════════════
 USING THE APPLICATION
════════════════════════════════════════════════════════════════════════════

  1. INPUT FILE
     Click "Browse File" and select your SPU log file. Both formats
     are supported:
       • Raw, uncleaned .csv files exported directly from the SPU
         system (any delimiter: comma, semicolon, tab, or pipe —
         auto-detected. Handles quote-wrapped/padded export formats
         automatically.)
       • Pre-cleaned .xlsx files

  2. TIME RANGE
     Set the Start Time and End Time using the up/down spinners
     (format: HH:MM, 24-hour clock).

  3. OUTPUT DIRECTORY
     Choose where the generated Excel reports should be saved.
     Defaults to a "SPU_Reports" folder in your home directory.

  4. GENERATE REPORTS
     Click the green "Generate Reports" button. Progress is shown
     live in the Activity Log on the right. Two files are created:
       • A filtered data export (all entries in the time range)
       • A full analysis report (6+ sheets: Summary with alarm tree,
         All Alarms, Class A/B/C/D breakdowns, Fault Code Reference,
         plus a dedicated sheet for every non-alarm event type)

  5. OPEN RESULTS
     Click "Open" next to any file in the Output Files list, or
     "Open Output Folder" to see everything in File Explorer.


════════════════════════════════════════════════════════════════════════════
 TROUBLESHOOTING
════════════════════════════════════════════════════════════════════════════

  "Python was installed but needs a restart"
      → Just close the window and double-click Install_and_Run.bat
        again. This refreshes Windows' PATH so Python becomes visible.

  Antivirus / Windows Defender blocks the download
      → This sometimes happens with automated downloads. If blocked,
        manually download Python from https://python.org/downloads
        and install it yourself (check "Add to PATH" during install),
        then run Install_and_Run.bat again — it will detect the
        existing installation and skip straight to package install.

  "File is open in Excel" error when generating reports
      → Close the Excel file first, then click Generate Reports again.

  App window doesn't appear after clicking Install_and_Run.bat
      → Check install_log.txt in this folder for details on what
        happened during setup. Common cause: antivirus quarantined
        a downloaded file — check your antivirus's quarantine list.

  Need to reinstall from scratch
      → Delete install_log.txt and run Install_and_Run.bat again.


════════════════════════════════════════════════════════════════════════════
 SYSTEM REQUIREMENTS
════════════════════════════════════════════════════════════════════════════

  • Windows 10 or Windows 11
  • ~200 MB free disk space (Python + packages)
  • Internet connection (first-time setup only, if Python is missing)
  • Administrator rights recommended for Python installation
    (the installer will still work without admin rights, installing
    Python for the current user only)

════════════════════════════════════════════════════════════════════════════
