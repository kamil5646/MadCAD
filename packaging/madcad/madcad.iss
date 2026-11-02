; MadCAD for Windows x64: a per-user installer (no administrator rights needed).
; Built by .github/workflows/madcad-windows.yml with: ISCC /DVersion=<ver> /DStage=<dir> /DOut=<dir> madcad.iss

#ifndef Version
  #define Version "0.0.0"
#endif

[Setup]
AppId={{6C0F2D7A-5E8B-4B1C-9A3E-4D2B7F1C8A10}
AppName=MadCAD
AppVersion={#Version}
AppVerName=MadCAD {#Version}
AppPublisher=Kamil Kasprzak
AppPublisherURL=https://madcad.madmagsystem.pl
VersionInfoVersion={#Version}
DefaultDirName={autopf}\MadCAD
DefaultGroupName=MadCAD
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#Out}
OutputBaseFilename=MadCAD-{#Version}-windows-x64-setup
SetupIconFile={#Stage}\MadCAD.ico
UninstallDisplayIcon={app}\MadCAD.exe
LicenseFile={#Stage}\LICENSE-MIT
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=yes
CloseApplications=yes

[Languages]
Name: "pl"; MessagesFile: "compiler:Languages\Polish.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#Stage}\MadCAD.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Stage}\solidcraft-cli.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Stage}\LICENSE-MIT"; DestDir: "{app}\Licenses"
Source: "{#Stage}\LICENSE-APACHE"; DestDir: "{app}\Licenses"
Source: "{#Stage}\NOTICE"; DestDir: "{app}\Licenses"
Source: "{#Stage}\THIRD-PARTY-LICENSES.txt"; DestDir: "{app}\Licenses"
Source: "{#Stage}\ATTRIBUTION.md"; DestDir: "{app}\Licenses"

[Icons]
Name: "{autoprograms}\MadCAD"; Filename: "{app}\MadCAD.exe"
Name: "{autodesktop}\MadCAD"; Filename: "{app}\MadCAD.exe"; Tasks: desktopicon

[Registry]
; .sc designs open in MadCAD; SolidCraft, when installed, stays in the "Open with" list.
Root: HKA; Subkey: "Software\Classes\.sc\OpenWithProgids"; ValueType: string; ValueName: "MadCAD.Design"; ValueData: ""; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\.sc"; ValueType: string; ValueName: ""; ValueData: "MadCAD.Design"; Flags: uninsdeletevalue createvalueifdoesntexist
Root: HKA; Subkey: "Software\Classes\MadCAD.Design"; ValueType: string; ValueName: ""; ValueData: "MadCAD"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\MadCAD.Design\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\MadCAD.exe,0"
Root: HKA; Subkey: "Software\Classes\MadCAD.Design\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\MadCAD.exe"" ""%1"""

[Run]
Filename: "{app}\MadCAD.exe"; Description: "{cm:LaunchProgram,MadCAD}"; Flags: nowait postinstall skipifsilent
