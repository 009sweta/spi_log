# -*- mode: python ; coding: utf-8 -*-
# ════════════════════════════════════════════════════════════════════════════
#  PyInstaller spec file — builds SPU_Log_Analyzer.exe as a single
#  standalone executable with NO Python installation required on the
#  target machine. All dependencies (pandas, openpyxl, chardet, tkinter)
#  are bundled directly inside the exe.
#
#  HOW TO BUILD (run on a Windows machine with Python installed):
#      1. pip install pyinstaller pandas openpyxl chardet
#      2. cd into this build_exe folder
#      3. pyinstaller spu_analyzer.spec
#      4. Find the finished exe at:  dist/SPU_Log_Analyzer.exe
#
#  See BUILD_INSTRUCTIONS.txt in this folder for full step-by-step details.
# ════════════════════════════════════════════════════════════════════════════

block_cipher = None

a = Analysis(
    ['../app/spu_log_analyzer.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'pandas',
        'pandas._libs.tslibs.timedeltas',
        'pandas._libs.tslibs.np_datetime',
        'pandas._libs.tslibs.nattype',
        'pandas._libs.skiplist',
        'openpyxl',
        'openpyxl.cell._writer',
        'chardet',
        'tkinter',
        'tkinter.ttk',
        'tkinter.filedialog',
        'tkinter.messagebox',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib', 'scipy', 'numpy.testing', 'pytest',
        'IPython', 'jupyter', 'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='SPU_Log_Analyzer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # GUI app — no console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app_icon.ico',    # optional — remove this line if you don't have an icon
    version='version_info.txt',  # optional — remove if not using version metadata
)
