import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { translateModelingText } from './i18n.js';
import { formatShortcut } from './platform-shortcuts.js';

const TOOL_DESCRIPTIONS = {
  'Utwórz szkic': 'Wybierz płaszczyznę i rozpocznij rysowanie profilu 2D.',
  'Prostokąt': 'Narysuj prostokątny profil, klikając środek i punkt rozmiaru.',
  'Okrąg': 'Narysuj okrąg, klikając środek i punkt promienia.',
  'Łuk': 'Utwórz dokładny łuk przez trzy punkty albo przez środek, początek i koniec.',
  'Wielokąt': 'Utwórz regularny wielokąt wpisany, opisany albo z zadanej krawędzi.',
  'Elipsa': 'Utwórz dokładną, obróconą elipsę z dwóch promieni.',
  'Slot': 'Utwórz zamknięty slot przez środki łuków albo długość całkowitą.',
  'Spline': 'Utwórz krzywą przez punkty dopasowania albo punkty kontrolne.',
  'Conic': 'Utwórz krzywą stożkową przez początek, punkt kontrolny i koniec.',
  'Punkt': 'Dodaj punkt referencyjny otworu albo punkt konstrukcyjny.',
  'Linia': 'Utwórz pojedynczy segment przez dwa punkty albo przez dokładną długość i kąt.',
  'Polilinia': 'Rysuj ciąg segmentów; kliknij punkt początkowy, aby zamknąć profil.',
  'Łuk styczny': 'Kontynuuj polilinię łukiem stycznym do poprzedniego segmentu.',
  'Thin Extrude': 'Wyciągnij otwarty łańcuch szkicu jako cienkościenną bryłę.',
  'Rib/Web': 'Utwórz żebro albo ściankę z otwartego profilu szkicu.',
  'Pipe': 'Utwórz pusty przewód wzdłuż zaznaczonej otwartej ścieżki.',
  'Import SVG/DXF': 'Wczytaj geometrię SVG lub DXF bezpośrednio do aktywnego szkicu.',
  'Import DWG': 'Wybierz plik DWG, przekształć go lokalnie do DXF i dodaj geometrię do aktywnego szkicu.',
  'Trim': 'Przytnij wskazany fragment krzywej do najbliższych przecięć.',
  'Extend': 'Przedłuż wskazany koniec krzywej do najbliższej geometrii.',
  'Break': 'Podziel wskazaną krzywą w wybranym punkcie.',
  'Przesuń': 'Przesuń zaznaczone punkty lub segmenty przeciągnięciem albo dokładnym ΔX i ΔY.',
  'Offset': 'Utwórz równoległą kopię zaznaczonej krzywej, łańcucha lub profilu; znak odległości wybiera stronę.',
  'Fillet szkicu': 'Zaokrąglij wspólny narożnik dokładnie dwóch zaznaczonych linii.',
  'Faza szkicu': 'Zetnij wspólny narożnik dokładnie dwóch zaznaczonych linii.',
  'Transformuj': 'Obróć, skopiuj, odbij lub przeskaluj zaznaczoną geometrię szkicu.',
  'Szyk szkicu': 'Powiel zaznaczoną geometrię w szyku prostokątnym, kołowym albo po ścieżce.',
  'Project': 'Przenieś wskazane wierzchołki i krawędzie modelu do szkicu jako trwale powiązaną geometrię.',
  'Usuń': 'Usuń zaznaczoną geometrię oraz bezpiecznie zależne profile i operacje.',
  'Zakończ szkic': 'Zamknij edycję szkicu i wróć do modelowania bryły.',
  'Współliniowe': 'Wymuś położenie dwóch wybranych linii na jednej prostej.',
  'Symetria': 'Utwórz więz symetrii dla wybranej geometrii względem osi.',
  'Krzywizna G2': 'Nadaj ciągłość krzywizny G2 pomiędzy zgodnymi krzywymi.',
  'Ordinate X': 'Dodaj wymiar współrzędnej X wybranego punktu.',
  'Ordinate Y': 'Dodaj wymiar współrzędnej Y wybranego punktu.',
  'Długość łuku': 'Dodaj sterujący wymiar długości wybranego łuku.',
  'Wyciągnij': 'Wyciągnij zaznaczony profil w bryłę; możesz też przeciągnąć niebieską strzałkę.',
  'Revolve': 'Obróć profil wokół wskazanej osi i utwórz bryłę obrotową.',
  'Sweep': 'Przeciągnij profil wzdłuż osobnej ścieżki szkicu.',
  'Loft': 'Połącz dwa profile płynną albo odcinkową bryłą przejściową.',
  'Coil': 'Utwórz parametryczną spiralę lub sprężynę wokół osi.',
  'Pattern': 'Powiel wybraną bryłę w szyku prostokątnym, kołowym albo po ścieżce.',
  'Press Pull': 'Wyciągnij lub wciśnij wybrany profil albo płaską ścianę.',
  'Prymityw': 'Utwórz dokładny box, walec, sferę albo torus.',
  'Tekst 3D': 'Utwórz tekst jako nową bryłę, wypukłość albo grawer.',
  'Boolean': 'Połącz, odejmij albo pozostaw część wspólną dwóch wskazanych brył.',
  'Otwór': 'Wytnij cylindryczny otwór z zaznaczonego profilu okręgu.',
  'Zaokrąglij': 'Zaokrąglij krawędzie zaznaczonej bryły podanym promieniem.',
  'Fazuj': 'Zetnij ostre krawędzie zaznaczonej bryły podaną odległością.',
  'Shell': 'Usuń wskazane ściany i nadaj bryle określoną grubość ścianki.',
  'Draft': 'Pochyl wskazane ściany względem płaszczyzny neutralnej.',
  'Split Body': 'Podziel wybraną bryłę wskazaną płaszczyzną.',
  'Split Face': 'Podziel ścianę geometrią wybranego profilu.',
  'Delete Face + Heal': 'Usuń wskazane ściany i automatycznie napraw sąsiednią geometrię.',
  'Replace Face': 'Zastąp jedną ścianę powierzchnią drugiej wskazanej ściany.',
  'Offset Face': 'Przesuń wskazaną ścianę o dokładną odległość.',
  'Przesuń bryłę': 'Przesuń wybraną bryłę o dokładny wektor.',
  'Obróć bryłę': 'Obróć wybraną bryłę o zadany kąt.',
  'Edytuj': 'Otwórz parametry zaznaczonego szkicu, profilu lub kroku historii.',
  'Parametry': 'Dodaj i zmień nazwane wymiary sterujące modelem.',
  'Płaszczyzna odsunięta': 'Utwórz nazwaną płaszczyznę konstrukcyjną w parametrycznej odległości od XY, XZ albo YZ.',
  'Płaszczyzna środkowa': 'Utwórz płaszczyznę dokładnie pośrodku dwóch równoległych położeń.',
  'Przez 3 punkty': 'Utwórz płaszczyznę przechodzącą przez trzy niewspółliniowe punkty 3D.',
  'Pod kątem': 'Utwórz płaszczyznę obróconą o zadany kąt wokół osi.',
  'Styczna': 'Utwórz płaszczyznę styczną do walca albo sfery.',
  'Na ścieżce': 'Utwórz płaszczyznę prostopadłą do ścieżki w zadanym punkcie.',
  'Oś z krawędzi': 'Utwórz trwałą oś z wybranej prostej krawędzi albo jej końców.',
  'Oś walca': 'Utwórz oś walca lub cylindrycznej ściany ze środka i kierunku.',
  'Oś 2 punkty': 'Utwórz parametryczną oś przechodzącą przez dwa punkty 3D.',
  'Oś przecięcia': 'Utwórz oś na linii przecięcia dwóch nazwanych płaszczyzn konstrukcyjnych.',
  'Oś normalna': 'Utwórz oś prostopadłą do wybranej płaszczyzny.',
  'Punkt wierzchołka': 'Utwórz punkt śledzący trwały wierzchołek bryły albo dokładne współrzędne.',
  'Punkt centrum': 'Utwórz punkt w centrum wybranej krawędzi, ściany lub walca.',
  'Punkt przecięcia': 'Utwórz punkt w dokładnym przecięciu osi konstrukcyjnej z płaszczyzną.',
  'Punkt środkowy': 'Utwórz punkt dokładnie pośrodku dwóch zadanych punktów.',
  'Punkt na osi': 'Utwórz punkt w podanej odległości wzdłuż osi konstrukcyjnej.',
  'Otwórz': 'Wczytaj zapisany projekt MadCAD z dysku.',
  'Wybierz': 'Wyczyść zaznaczenie i wróć do trybu wyboru obiektów.',
  'STL': 'Eksportuj siatkę gotową do programu przygotowującego druk 3D.',
  'STEP': 'Eksportuj dokładną bryłę B-Rep do wymiany z innymi programami CAD.',
  '3MF': 'Eksportuj model i jego jednostki do archiwum 3MF.',
  'STEP / STL / 3MF': 'Wczytaj model STEP, STL albo 3MF do bieżącego projektu.',
  'Druk 3D': 'Otwórz kontrolę gabarytów i ustawień eksportu do druku 3D.',
  'Kontrola druku': 'Sprawdź, czy model mieści się na stole drukarki.',
  'Zmierz': 'Pokaż dokładne wymiary zaznaczonej bryły, ściany, krawędzi, wierzchołka albo pary elementów.',
  'Przekrój': 'Włącz interaktywną płaszczyznę przekroju bez zmiany historii modelu.',
  'Właściwości masy': 'Oblicz objętość, pole, masę i środek masy dla zadanej gęstości materiału.',
  'Sprawdź geometrię': 'Sprawdź minimalny promień oraz dokładne kolizje pomiędzy bryłami.',
  'Punkty zapisu': 'Utwórz lub przywróć lokalną, nazwaną wersję bieżącego projektu.',
  'Porównaj wersje': 'Porównaj bieżący projekt z punktem zapisu albo innym plikiem MadCAD.',
  'Kondycja projektu': 'Sprawdź integralność dokumentu, historii, referencji i silnika CAD.',
  'Gdzie używane': 'Pokaż zależności zaznaczonego obiektu oraz wpływ jego zmiany.',
};

const TOOL_SHORTCUTS = Object.freeze({
  'Linia': 'L',
  'Polilinia': 'PL',
  'Prostokąt': 'R',
  'Okrąg': 'C',
  'Trim': 'T',
  'Extend': 'EX',
  'Break': 'BR',
  'Offset': 'O',
  'Fillet szkicu': 'F',
  'Faza szkicu': 'CHA',
  'Zaokrąglij': 'F',
  'Fazuj': 'CHA',
  'Project': 'P',
  'Przesuń': 'M',
  'Przesuń bryłę': 'M',
  'Zmierz': 'I',
  'Usuń': 'DEL',
  'Wyciągnij': 'E',
});

const TOOL_COLOR_GROUPS = Object.freeze({
  sketch: new Set(['Utwórz szkic', 'Linia', 'Polilinia', 'Łuk styczny', 'Łuk', 'Prostokąt', 'Okrąg', 'Wielokąt', 'Elipsa', 'Slot', 'Spline', 'Conic', 'Punkt', 'Zakończ szkic']),
  solid: new Set(['Wyciągnij', 'Thin Extrude', 'Rib/Web', 'Pipe', 'Revolve', 'Sweep', 'Loft', 'Coil', 'Pattern', 'Press Pull', 'Prymityw', 'Tekst 3D', 'Boolean', 'Otwór']),
  edit: new Set(['Trim', 'Extend', 'Break', 'Offset', 'Fillet szkicu', 'Faza szkicu', 'Transformuj', 'Szyk szkicu', 'Przesuń', 'Zaokrąglij', 'Fazuj', 'Shell', 'Draft', 'Split Body', 'Split Face', 'Replace Face', 'Offset Face', 'Przesuń bryłę', 'Obróć bryłę', 'Edytuj']),
  reference: new Set(['Project', 'Współliniowe', 'Symetria', 'Krzywizna G2', 'Ordinate X', 'Ordinate Y', 'Długość łuku', 'Płaszczyzna odsunięta', 'Płaszczyzna środkowa', 'Przez 3 punkty', 'Pod kątem', 'Styczna', 'Na ścieżce', 'Oś z krawędzi', 'Oś walca', 'Oś 2 punkty', 'Oś przecięcia', 'Oś normalna', 'Punkt wierzchołka', 'Punkt centrum', 'Punkt przecięcia', 'Punkt środkowy', 'Punkt na osi']),
  inspect: new Set(['Parametry', 'Zmierz', 'Przekrój', 'Właściwości masy', 'Sprawdź geometrię', 'Punkty zapisu', 'Porównaj wersje', 'Kondycja projektu', 'Gdzie używane', 'Wybierz']),
  output: new Set(['Import SVG/DXF', 'Import DWG', 'STEP / STL / 3MF', 'STEP', 'STL', '3MF', 'Kontrola druku']),
  destructive: new Set(['Usuń', 'Delete Face + Heal']),
});

const TOOL_GROUP_HUES = Object.freeze({ sketch: 190, solid: 218, edit: 38, reference: 166, inspect: 274, output: 138, destructive: 356, neutral: 208 });
const FEATURED_TOOL_LABELS = new Set(['Utwórz szkic', 'Linia', 'Wyciągnij', 'Wybierz', 'Trim', 'Zakończ szkic', 'Parametry', 'STEP']);

function toolColorStyle(label) {
  const group = Object.entries(TOOL_COLOR_GROUPS).find(([, labels]) => labels.has(label))?.[0] || 'neutral';
  const hue = TOOL_GROUP_HUES[group];
  return {
    '--tool-accent': `hsl(${hue} 84% 68%)`,
  };
}

export const ToolHelpContext = React.createContext(null);

function shortcutLabel(shortcut) {
  return formatShortcut(shortcut, window.desktopApp?.platform);
}


function ToolGlyph({ icon: Icon, compact = false, featured = false }) {
  const size = compact ? 21 : featured ? 32 : 27;
  return (
    <span className="ribbon-glyph">
      <Icon className="ribbon-glyph-depth" size={size} strokeWidth={2.35} fill="currentColor" fillOpacity={0.12} aria-hidden="true" />
      <Icon className="ribbon-glyph-face" size={size} strokeWidth={1.85} fill="currentColor" fillOpacity={0.08} aria-hidden="true" />
    </span>
  );
}

export function ToolButton({ id, icon: Icon, label, displayLabel = label, onClick, disabled = false, primary = false, compact = false, title, description, disabledReason }) {
  const help = description || title || TOOL_DESCRIPTIONS[label] || label;
  const contextualHelp = disabled
    ? `${disabledReason ? `Niedostępne. ${disabledReason}` : 'Niedostępne w bieżącym kontekście.'} ${help}`
    : help;
  const featured = FEATURED_TOOL_LABELS.has(label);
  const toolHelp = React.useContext(ToolHelpContext);
  const customCommand = toolHelp?.customizationForTool?.(label) || null;
  const shortcut = customCommand ? (customCommand.shortcut || customCommand.alias) : (TOOL_SHORTCUTS[label] || null);
  const registryShortcuts = customCommand
    ? [...new Set([customCommand.alias, customCommand.shortcut].filter(Boolean))]
    : [shortcut].filter(Boolean);
  const registryKey = registryShortcuts.join('|');
  useEffect(() => {
    const cleanups = registryShortcuts.filter((value) => !['ESC', 'CTRL+ENTER'].includes(value)).map((value) => toolHelp?.registerShortcut(value, { label, onClick, disabled })).filter(Boolean);
    return () => cleanups.forEach((cleanup) => cleanup());
  // registryKey is the stable scalar representation of registryShortcuts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, label, onClick, registryKey, toolHelp]);
  const showHelp = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toolHelp?.setToolHelp({
      label: displayLabel,
      help: contextualHelp,
      shortcut: shortcut ? shortcutLabel(shortcut) : null,
      x: Math.min(window.innerWidth - 184, Math.max(184, rect.left + (rect.width / 2))),
      y: rect.bottom + 8,
    });
  };
  return (
    <span className={`ribbon-tool-wrap ${featured ? 'featured' : ''} ${disabled ? 'disabled' : ''}`} onMouseEnter={showHelp} onMouseLeave={() => toolHelp?.setToolHelp(null)} onFocus={showHelp} onBlur={() => toolHelp?.setToolHelp(null)}>
      <button
        id={id}
        className={`ribbon-tool ${featured ? 'featured' : ''} ${primary ? 'primary' : ''} ${compact ? 'compact' : ''}`}
        style={toolColorStyle(label)}
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-tool-label={label}
        title={`${contextualHelp}${shortcut ? ` Skrót: ${shortcutLabel(shortcut)}.` : ''}`}
        aria-label={`${displayLabel}. ${contextualHelp}${shortcut ? ` Skrót: ${shortcutLabel(shortcut)}.` : ''}`}
      >
        <span className="ribbon-icon" aria-hidden="true"><ToolGlyph icon={Icon} compact={compact} featured={featured} /></span>
        <span className="ribbon-label">{displayLabel}</span>
      </button>
    </span>
  );
}

export function ToolMenuButton({ icon: Icon, label, displayLabel = label, items, disabled = false, description }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const itemsRef = useRef(items);
  const toolHelp = React.useContext(ToolHelpContext);
  itemsRef.current = items;
  const shortcutEntries = items.flatMap((item) => {
    const customCommand = toolHelp?.customizationForTool?.(item.label) || null;
    const shortcuts = customCommand
      ? [...new Set([customCommand.alias, customCommand.shortcut].filter(Boolean))]
      : [TOOL_SHORTCUTS[item.label]].filter(Boolean);
    return shortcuts.filter((value) => !['ESC', 'CTRL+ENTER'].includes(value)).map((shortcut) => ({ label: item.label, shortcut, disabled: disabled || item.disabled }));
  });
  const shortcutRegistryKey = shortcutEntries.map((entry) => `${entry.label}:${entry.shortcut}:${entry.disabled ? 1 : 0}`).join('|');
  useEffect(() => {
    const cleanups = shortcutEntries.map((entry) => toolHelp?.registerShortcut(entry.shortcut, {
      label: entry.label,
      disabled: entry.disabled,
      onClick: (...args) => itemsRef.current.find((item) => item.label === entry.label)?.onClick?.(...args),
    })).filter(Boolean);
    return () => cleanups.forEach((cleanup) => cleanup());
  // shortcutRegistryKey is the stable scalar representation of submenu shortcuts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcutRegistryKey, toolHelp]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const closeWithEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);
  return (
    <span className="ribbon-tool-wrap ribbon-tool-menu-wrap" ref={menuRef}>
      <button
        className={`ribbon-tool ribbon-tool-menu-trigger ${open ? 'primary' : ''}`}
        style={toolColorStyle(items[0]?.label || label)}
        type="button"
        disabled={disabled}
        data-tool-label={label}
        title={description || displayLabel}
        aria-label={`${displayLabel}. ${description || 'Pokaż dostępne polecenia.'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ribbon-icon" aria-hidden="true"><ToolGlyph icon={Icon} /></span>
        <span className="ribbon-label">{displayLabel}<ChevronDown size={10} /></span>
      </button>
      {open && <div className="ribbon-tool-submenu" role="menu" aria-label={displayLabel}>
        {items.map((item) => {
          const ItemIcon = item.icon;
          const help = item.description || TOOL_DESCRIPTIONS[item.label] || item.label;
          const customCommand = toolHelp?.customizationForTool?.(item.label) || null;
          const shortcut = customCommand ? (customCommand.shortcut || customCommand.alias) : (TOOL_SHORTCUTS[item.label] || null);
          const fullHelp = `${help}${shortcut ? ` Skrót: ${shortcutLabel(shortcut)}.` : ''}`;
          const itemDisplayLabel = item.displayLabel || item.label;
          const itemHelp = item.disabled
            ? `${item.disabledReason ? `Niedostępne. ${item.disabledReason}` : 'Niedostępne w bieżącym kontekście.'} ${fullHelp}`
            : fullHelp;
          return <button key={item.label} data-tool-label={item.label} type="button" role="menuitem" disabled={item.disabled} title={itemHelp} aria-label={`${itemDisplayLabel}. ${itemHelp}`} onClick={(event) => { item.onClick?.(event); setOpen(false); }}>
            <span style={toolColorStyle(item.label)} aria-hidden="true"><ToolGlyph icon={ItemIcon} compact /></span>
            <span><strong>{itemDisplayLabel}</strong><small>{item.disabled && item.disabledReason ? item.disabledReason : help}</small></span>
          </button>;
        })}
      </div>}
    </span>
  );
}

export const RibbonGroup = React.forwardRef(function RibbonGroup({ children, end = false, hidden = false, label }, ref) {
  return (
    <div ref={ref} className={`ribbon-group ${end ? 'ribbon-group-end' : ''}`} role="group" aria-label={label} hidden={hidden}>
      <div className="ribbon-group-heading">{label}</div>
      <div className="ribbon-tools">{children}</div>
    </div>
  );
});

function flattenRibbonGroups(children) {
  const groups = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) groups.push(...flattenRibbonGroups(child.props.children));
    else groups.push(child);
  });
  return groups;
}

export function calculateVisibleRibbonGroups(widths, availableWidth, stickyIndices = [], overflowWidth = 78) {
  const sticky = new Set(stickyIndices);
  const normalIndices = widths.map((_, index) => index).filter((index) => !sticky.has(index));
  const stickyWidth = stickyIndices.reduce((total, index) => total + (widths[index] || 0), 0);
  const fullWidth = widths.reduce((total, width) => total + width, 0);
  if (fullWidth <= availableWidth) return { visible: normalIndices, hidden: [] };

  const budget = Math.max(0, availableWidth - stickyWidth - overflowWidth);
  const visible = [];
  let used = 0;
  for (const index of normalIndices) {
    const width = widths[index] || 0;
    if (used + width > budget) break;
    visible.push(index);
    used += width;
  }
  return { visible, hidden: normalIndices.filter((index) => !visible.includes(index)) };
}

function RibbonOverflowTool({ tool, onSelect }) {
  if (!React.isValidElement(tool)) return null;
  const { disabled = false, icon: Icon, label, displayLabel = label, onClick, description, title, items } = tool.props;
  const help = description || title || TOOL_DESCRIPTIONS[label] || label;
  if (items?.length) return (
    <div className="ribbon-overflow-submenu" role="none">
      <strong><span className="ribbon-overflow-icon" aria-hidden="true"><ToolGlyph icon={Icon} compact /></span>{displayLabel}</strong>
      {items.map((item) => {
        const ItemIcon = item.icon;
        return <button key={item.label} data-tool-label={item.label} className="ribbon-overflow-tool" style={toolColorStyle(item.label)} type="button" role="menuitem" disabled={item.disabled} onClick={(event) => { item.onClick?.(event); onSelect(); }}>
          <span className="ribbon-overflow-icon" aria-hidden="true"><ToolGlyph icon={ItemIcon} compact /></span><span>{item.displayLabel || item.label}</span>
        </button>;
      })}
    </div>
  );
  return (
    <button
      className="ribbon-overflow-tool"
      data-tool-label={label}
      style={toolColorStyle(label)}
      type="button"
      role="menuitem"
      disabled={disabled}
      title={help}
      onClick={(event) => {
        onClick?.(event);
        onSelect();
      }}
    >
      {Icon && <span className="ribbon-overflow-icon" aria-hidden="true"><ToolGlyph icon={Icon} compact /></span>}
      <span>{displayLabel}</span>
    </button>
  );
}

function RibbonOverflow({ groups, language = 'pl' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const translatedGroupLabels = groups.map((group) => translateModelingText(group.props.label, language));
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);
  if (!groups.length) return null;
  return (
    <div className="ribbon-overflow" ref={menuRef}>
      <button
        className={`ribbon-overflow-trigger ${open ? 'active' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${language === 'en' ? 'Show hidden groups' : 'Pokaż ukryte grupy'}: ${translatedGroupLabels.join(', ')}`}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
        <span>{language === 'en' ? 'More' : 'Więcej'} ({groups.length})</span>
      </button>
      {open && (
        <div className={`ribbon-overflow-menu ${groups.length === 1 ? 'single-group' : ''}`} role="menu" aria-label="Pozostałe grupy narzędzi">
          {groups.map((group, groupIndex) => (
            <section className="ribbon-overflow-section" key={`${group.props.label}-${groupIndex}`} role="none">
              <strong>{group.props.label}</strong>
              <div>
                {React.Children.map(group.props.children, (tool) => (
                  <RibbonOverflowTool tool={tool} onSelect={() => setOpen(false)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResponsiveRibbon({ children, language = 'pl' }) {
  const groups = flattenRibbonGroups(children);
  const groupSignature = groups.map((group) => `${group.props.label}:${group.props.end ? '1' : '0'}`).join('|');
  const groupCount = groups.length;
  const stickyKey = groups.map((group, index) => (group.props.end ? index : -1)).filter((index) => index >= 0).join(',');
  const containerRef = useRef(null);
  const groupRefs = useRef([]);
  const measuredWidths = useRef([]);
  const [layout, setLayout] = useState({ visible: groups.map((_, index) => index), hidden: [] });

  useLayoutEffect(() => {
    measuredWidths.current = [];
    setLayout({ visible: Array.from({ length: groupCount }, (_, index) => index), hidden: [] });
  }, [groupCount, groupSignature]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const update = () => {
      groupRefs.current.forEach((node, index) => {
        if (!node) return;
        const width = Math.ceil(node.getBoundingClientRect().width);
        if (width > 0) measuredWidths.current[index] = width;
      });
      if (measuredWidths.current.length < groupCount || measuredWidths.current.some((width) => !width)) return;
      const stickyIndices = stickyKey ? stickyKey.split(',').map(Number) : [];
      const next = calculateVisibleRibbonGroups(measuredWidths.current, container.clientWidth, stickyIndices);
      setLayout((current) => (
        current.visible.join(',') === next.visible.join(',') && current.hidden.join(',') === next.hidden.join(',')
          ? current
          : next
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    groupRefs.current.forEach((node) => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [groupCount, groupSignature, stickyKey]);

  const stickyIndices = new Set(stickyKey ? stickyKey.split(',').map(Number) : []);
  const visibleIndices = new Set(layout.visible);
  const hiddenGroups = groups.filter((_, index) => !stickyIndices.has(index) && !visibleIndices.has(index));
  return (
    <div ref={containerRef} className="modeling-ribbon" role="toolbar" aria-label="Narzędzia aktywnego obszaru roboczego" tabIndex="0">
      <div className="ribbon-visible-groups">
        {groups.map((group, index) => stickyIndices.has(index) ? null : React.cloneElement(group, {
          key: group.key || `${group.props.label}-${index}`,
          ref: (node) => { groupRefs.current[index] = node; },
          hidden: !visibleIndices.has(index),
        }))}
      </div>
      <RibbonOverflow groups={hiddenGroups} language={language} />
      <div className="ribbon-sticky-groups">
        {groups.map((group, index) => stickyIndices.has(index) ? React.cloneElement(group, {
          key: `sticky-${group.key || `${group.props.label}-${index}`}`,
          ref: (node) => { groupRefs.current[index] = node; },
        }) : null)}
      </div>
    </div>
  );
}
