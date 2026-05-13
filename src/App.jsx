import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Info, ChevronRight, Building2, Calculator, BookOpen } from 'lucide-react';
import { C, UTDELNINGSAR, calculateAll, aggregate } from './calc.js';

const VERSION = '1.2.0';

const formatKr = (n) => {
  if (n == null || isNaN(n)) return '0 kr';
  return Math.round(n).toLocaleString('sv-SE').replace(/,/g, ' ') + ' kr';
};

const formatPct = (n) => new Intl.NumberFormat('sv-SE', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(n);

const clamp = (val, min, max) => {
  let v = val;
  if (typeof min === 'number') v = Math.max(min, v);
  if (typeof max === 'number') v = Math.min(max, v);
  return v;
};

const InfoBox = ({ title, children }) => (
  <div className="border bg-gray-100 border-gray-200 rounded-md p-5 text-sm">
    <div className="flex gap-2 items-start">
      <Info size={16} className="flex-shrink-0 mt-0.5 text-gray-500" />
      <div>
        {title && <div className="font-medium mb-1 text-gray-800">{title}</div>}
        <div className="text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  </div>
);

const formatInputValue = (n, decimals = 0) => {
  if (n == null || n === 0 || isNaN(n)) return '';
  return new Intl.NumberFormat('sv-SE', {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n).replace(/ /g, ' ');
};

const parseInputValue = (str, allowDecimal = false) => {
  if (!str) return 0;
  if (allowDecimal) {
    const normalized = str.replace(/\s/g, '').replace(',', '.');
    const cleaned = normalized.replace(/[^\d.]/g, '');
    const parsed = Number(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  const cleaned = str.replace(/[^\d]/g, '');
  return cleaned === '' ? 0 : Number(cleaned);
};

const NumInput = ({ label, value, onChange, suffix = 'kr', placeholder, hint, min = 0, max, decimals = 0 }) => {
  const [text, setText] = useState(() => formatInputValue(value, decimals));

  const handleChange = (e) => {
    const newText = e.target.value;
    const parsed = parseInputValue(newText, decimals > 0);
    const clamped = clamp(parsed, min, max);
    // Behåll exakt det användaren skrivit om värdet är inom intervallet (så "7," kan stå kvar
    // medan man fortsätter skriva "7,73"). Vid klampning, visa det klampade värdet direkt.
    setText(parsed === clamped ? newText : formatInputValue(clamped, decimals));
    onChange(clamped);
  };

  const handleBlur = () => {
    setText(formatInputValue(value, decimals));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder || '0'}
          className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white text-gray-900"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">{suffix}</span>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
};

const TextInput = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white text-gray-900"
    />
  </div>
);

const makeBolag = (overrides = {}) => ({
  id: Date.now() + Math.random(),
  namn: '',
  ownership: 0,
  hasSpouse: false,
  spouseOwnership: 0,
  totalSalary: 0,
  salary: 0,
  costBasis: 0,
  savedAmount: 0,
  planeradUtdelning: 0,
  ...overrides,
});

const BolagForm = ({ bolag, index, total, onUpdate, onRemove }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Building2 size={18} className="text-brand-light" />
        Företag {index + 1} av {total}{bolag.namn ? ` · ${bolag.namn}` : ''}
      </h3>
      {total > 1 && (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-700 p-1.5"
          aria-label="Ta bort företag"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>

    <TextInput
      label="Företagsnamn (valfritt)"
      value={bolag.namn}
      onChange={(v) => onUpdate('namn', v)}
      placeholder="t.ex. Företaget AB"
    />

    <div className="grid grid-cols-2 gap-3">
      <NumInput
        label="Ägarandel"
        value={bolag.ownership}
        onChange={(v) => onUpdate('ownership', v)}
        suffix="%"
        max={100}
        decimals={2}
      />
    </div>

    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={bolag.hasSpouse}
          onChange={(e) => onUpdate('hasSpouse', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
        />
        <span className="text-sm text-gray-700">Äger med make/maka eller likställd (IL 2 kap 20 §)</span>
      </label>
      <p className="text-xs text-gray-500 mt-2">
        Beräkningen visar gränsbeloppet för dig — kör en separat beräkning för make/maka. Likställd = registrerat partnerskap, sambo som tidigare varit gift, eller sambo med gemensamma barn.
      </p>
      {bolag.hasSpouse && (
        <div className="mt-3">
          <NumInput
            label="Makes/makas andel"
            value={bolag.spouseOwnership}
            onChange={(v) => onUpdate('spouseOwnership', v)}
            suffix="%"
            max={100}
            decimals={2}
            hint="Gemensam beräkning av lönebaserat utrymme (ett löneavdrag om 8 IBB) som sedan fördelas på era aktier."
          />
        </div>
      )}
    </div>

    <NumInput
      label="Total lönesumma 2025"
      value={bolag.totalSalary}
      onChange={(v) => onUpdate('totalSalary', v)}
      hint="Kontanta bruttolöner året före utdelningen, inkl. ägarlöner och löner från dotterföretag. Förmåner och statliga lönebidrag räknas inte med."
    />

    <NumInput
      label="Din lön 2025"
      value={bolag.salary}
      onChange={(v) => onUpdate('salary', v)}
      hint="Din lön — eller den högsta bland närstående om någon i kretsen (IL 2:22§) tjänat mer. Används för takregeln 50 × lön."
    />

    <NumInput
      label="Omkostnadsbelopp"
      value={bolag.costBasis}
      onChange={(v) => onUpdate('costBasis', v)}
      hint="Vad du betalat för aktierna + eventuella ovillkorade aktieägartillskott. Ränta räknas bara på del över 100 000 kr."
    />

    <NumInput
      label="Sparat utdelningsutrymme"
      value={bolag.savedAmount}
      onChange={(v) => onUpdate('savedAmount', v)}
      hint="Från tidigare år. Förs vidare nominellt — räknas inte upp med ränta från och med 2026."
    />

    <NumInput
      label={`Planerad utdelning ${UTDELNINGSAR}`}
      value={bolag.planeradUtdelning}
      onChange={(v) => onUpdate('planeradUtdelning', v)}
      hint="Lämna 0 för att bara se gränsbeloppet. Annars delas utdelningen upp i kapital 20 % / tjänst / kapital 30 %."
    />
  </div>
);

const BolagResult = ({ r, index, total }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div className="px-5 py-5">
      <div className="text-sm text-gray-500 mb-1">
        Företag {index + 1} av {total}{r.namn ? ` · ${r.namn}` : ''}
      </div>
      <div className="text-3xl font-semibold text-brand">
        {formatKr(r.totaltGransbelopp)}
      </div>
      <div className="text-sm text-gray-500">totalt gränsbelopp för utdelning {UTDELNINGSAR}</div>
    </div>
    <div className="px-5 py-5 grid grid-cols-3 gap-4 border-t border-brand-100 bg-brand-50">
      <div>
        <div className="text-xs text-gray-600">Årets gränsbelopp</div>
        <div className="font-semibold text-brand">{formatKr(r.aretsGransbelopp)}</div>
      </div>
      <div>
        <div className="text-xs text-gray-600">Sparat utrymme</div>
        <div className="font-semibold text-brand">{formatKr(r.savedAmount)}</div>
      </div>
      <div>
        <div className="text-xs text-gray-600">{r.utdelning > 0 ? 'Nytt sparat till nästa år' : 'Outnyttjat utrymme'}</div>
        <div className="font-semibold text-brand">{formatKr(r.nyttSparat)}</div>
      </div>
    </div>

    <details className="border-t border-gray-100 group">
      <summary className="px-5 py-3 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-between cursor-pointer">
        <span>Beräkning steg för steg</span>
        <ChevronRight size={16} className="group-open:rotate-90 transition-transform" />
      </summary>

      <div className="px-5 pb-5 pt-4 space-y-5 text-sm bg-gray-50">
        <div>
          <div className="font-medium text-gray-800 mb-1.5">Grundbelopp (4 IBB)</div>
          <div className="bg-white rounded p-3 border border-gray-200 space-y-1 text-gray-700">
            <div className="flex justify-between"><span>4 × IBB 2025</span><span>{formatKr(C.GRUNDBELOPP)}</span></div>
            <div className="flex justify-between text-gray-500">
              <span>× din ägarandel i detta bolag</span>
              <span>{formatPct(r.ownFrac)}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-gray-100 font-medium">
              <span>Din andel av grundbeloppet</span>
              <span>{formatKr(r.grundbeloppFordelat)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="font-medium text-gray-800 mb-1.5">Lönebaserat utrymme</div>
          <div className="bg-white rounded p-3 border border-gray-200 space-y-1 text-gray-700">
            {r.hasSpouse && (
              <div className="text-xs text-brand bg-brand-50 -mx-3 -mt-3 mb-2 px-3 py-2 border-b border-brand-100">
                Gemensam beräkning för makar — löneavdrag (8 IBB) dras en gång på parets sammanlagda ägarandel och fördelas sedan.
              </div>
            )}
            <div className="flex justify-between">
              <span>Andel av löneunderlaget ({formatPct(r.groupOwnership)})</span>
              <span>{formatKr(r.andelAvLoneunderlag)}</span>
            </div>
            <div className="flex justify-between text-gray-500"><span>− Löneavdrag (8 IBB)</span><span>−{formatKr(C.LONEAVDRAG)}</span></div>
            <div className="flex justify-between"><span>= Efter löneavdrag</span><span>{formatKr(r.efterLoneavdrag)}</span></div>
            <div className="flex justify-between text-gray-500"><span>× 50 %</span><span></span></div>
            <div className="flex justify-between pt-1 mt-1 border-t border-gray-100">
              <span>{r.hasSpouse ? 'Lönebaserat utrymme (paret)' : 'Lönebaserat utrymme'}</span>
              <span>{formatKr(r.lonebaseratGruppen)}</span>
            </div>
            {r.hasSpouse && (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>× din andel av parets ägande ({formatPct(r.memberShareOfGroup)})</span>
                  <span></span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Din del</span>
                  <span>{formatKr(r.lonebaseratFordelat)}</span>
                </div>
              </>
            )}
            {r.takregelTillampad && (
              <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50 -mx-3 -mb-3 px-3 py-2">
                <div className="text-xs text-amber-900">
                  Takregeln slår in: 50 × högsta lön i kretsen ({formatKr(r.salary)}) = {formatKr(r.takregel)}
                </div>
              </div>
            )}
            <div className="flex justify-between pt-1 mt-1 border-t border-gray-100 font-medium">
              <span>Slutligt lönebaserat utrymme</span>
              <span>{formatKr(r.lonebaseratFinal)}</span>
            </div>
          </div>
        </div>

        {r.rantaOmkost > 0 && (
          <div>
            <div className="font-medium text-gray-800 mb-1.5">Ränta på omkostnadsbelopp</div>
            <div className="bg-white rounded p-3 border border-gray-200 space-y-1 text-gray-700">
              <div className="flex justify-between"><span>Omkostnadsbelopp över 100 000 kr</span><span>{formatKr(r.omkostOverGrans)}</span></div>
              <div className="flex justify-between text-gray-500"><span>× ränta (SLR 2,55 % + 9 pe)</span><span>11,55 %</span></div>
              <div className="flex justify-between pt-1 mt-1 border-t border-gray-100 font-medium"><span>Ränta</span><span>{formatKr(r.rantaOmkost)}</span></div>
            </div>
          </div>
        )}

        <div>
          <div className="font-medium text-gray-800 mb-1.5">Summering</div>
          <div className="bg-white rounded p-3 border border-gray-200 space-y-1 text-gray-700">
            <div className="flex justify-between"><span>Grundbelopp</span><span>{formatKr(r.grundbeloppFordelat)}</span></div>
            <div className="flex justify-between"><span>+ Lönebaserat utrymme</span><span>{formatKr(r.lonebaseratFinal)}</span></div>
            <div className="flex justify-between"><span>+ Ränta på omkostnadsbelopp</span><span>{formatKr(r.rantaOmkost)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-1 mt-1"><span>Årets gränsbelopp</span><span>{formatKr(r.aretsGransbelopp)}</span></div>
            <div className="flex justify-between"><span>+ Sparat utdelningsutrymme</span><span>{formatKr(r.savedAmount)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 font-medium text-gray-900 text-base">
              <span>Totalt gränsbelopp</span>
              <span>{formatKr(r.totaltGransbelopp)}</span>
            </div>
          </div>
        </div>

        {r.utdelning > 0 && (
          <div>
            <div className="font-medium text-gray-800 mb-1.5">Beskattning av planerad utdelning</div>
            <div className="bg-white rounded p-3 border border-gray-200 space-y-1 text-gray-700">
              <div className="flex justify-between"><span>Planerad utdelning</span><span>{formatKr(r.utdelning)}</span></div>
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Inom gränsbelopp — kapital 20 %</span>
                  <span>{formatKr(r.utdInomGrans)}</span>
                </div>
                {r.utdTjanst > 0 && (
                  <div className="flex justify-between">
                    <span>Över gränsbelopp upp till takbeloppet — tjänst</span>
                    <span>{formatKr(r.utdTjanst)}</span>
                  </div>
                )}
                {r.utdOverTak > 0 && (
                  <div className="flex justify-between">
                    <span>Över takbeloppet ({formatKr(C.TAKBELOPP_90_IBB)}) — kapital 30 %</span>
                    <span>{formatKr(r.utdOverTak)}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1 text-gray-500 text-xs">
                <div className="flex justify-between">
                  <span>Skatt på del inom gränsbelopp (20 %)</span>
                  <span>{formatKr(r.skattInomGrans)}</span>
                </div>
                {r.utdOverTak > 0 && (
                  <div className="flex justify-between">
                    <span>Skatt på del över takbeloppet (30 %)</span>
                    <span>{formatKr(r.skattOverTak)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 font-medium text-gray-900">
                <span>Kapitalskatt totalt</span>
                <span>{formatKr(r.totalKapitalskatt)}</span>
              </div>
              {r.utdTjanst > 0 && (
                <div className="text-xs text-amber-900 bg-amber-50 -mx-3 -mb-3 px-3 py-2 mt-2 border-t border-amber-200">
                  Tjänstedelen ({formatKr(r.utdTjanst)}) beskattas som inkomst av tjänst — skattesatsen är variabel (cirka 32–57 %) beroende på din övriga inkomst och kommun. Den ingår inte i den summa som visas ovan.
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2 border-t border-gray-100">
                <span>Nytt sparat utdelningsutrymme till nästa år</span>
                <span>{formatKr(r.nyttSparat)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </details>
  </div>
);

export default function App() {
  const [bolag, setBolag] = useState([makeBolag()]);

  const { totalOwnership, exceedsCap, results } = useMemo(() => calculateAll(bolag), [bolag]);
  const totals = useMemo(() => aggregate(results), [results]);

  const updateBolag = (id, field, value) => {
    setBolag((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };
  const addBolag = () => setBolag((prev) => [...prev, makeBolag()]);
  const removeBolag = (id) => setBolag((prev) => prev.length > 1 ? prev.filter((b) => b.id !== id) : prev);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="pt-3">
            <a href="https://stormyran.se" target="_blank" rel="noopener noreferrer" aria-label="Stormyran" className="inline-block">
              <img src="/stormyran-logo.svg" alt="Stormyran" className="h-9 w-auto" />
            </a>
          </div>
          <div className="py-3 flex items-baseline justify-between flex-wrap gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="text-brand" size={22} strokeWidth={2} />
              <span><span className="text-brand">3:12</span>-kalkylator</span>
              <span className="hidden md:inline text-sm font-normal text-gray-500 ml-2">· Gränsbelopp för utdelning {UTDELNINGSAR}</span>
            </h1>
            <div className="text-xs text-gray-400">v{VERSION}</div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">

          <div className="lg:col-span-2 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="inline-block w-1 h-5 bg-brand rounded-sm"></span>
              Företag
            </h2>
            {exceedsCap && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Dina sammanlagda ägarandelar är {formatPct(totalOwnership)} — grundbeloppet (max 4 IBB = {formatKr(C.GRUNDBELOPP)}) fördelas proportionellt mellan dina bolag så att totalen inte överstiger taket.
              </div>
            )}
            {bolag.map((b, idx) => (
              <BolagForm
                key={b.id}
                bolag={b}
                index={idx}
                total={bolag.length}
                onUpdate={(field, value) => updateBolag(b.id, field, value)}
                onRemove={() => removeBolag(b.id)}
              />
            ))}
            <button
              type="button"
              onClick={addBolag}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={16} strokeWidth={2.5} /> Lägg till företag
            </button>
          </div>

          <div className="lg:col-span-3 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="inline-block w-1 h-5 bg-brand rounded-sm"></span>
              Gränsbelopp
            </h2>
            {bolag.length > 1 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-5 py-5">
                  <div className="text-sm text-gray-500 mb-1">Totalt över alla bolag</div>
                  <div className="text-3xl font-semibold text-brand">
                    {formatKr(totals.totaltGransbelopp)}
                  </div>
                  <div className="text-sm text-gray-500">totalt gränsbelopp för utdelning {UTDELNINGSAR}</div>
                </div>
                <div className="px-5 py-5 grid grid-cols-2 gap-4 border-t border-brand-100 bg-brand-50">
                  <div>
                    <div className="text-xs text-gray-600">Total grundbelopp över alla bolag</div>
                    <div className="font-semibold text-brand">{formatKr(totals.grundbelopp)}{exceedsCap ? ` (max 4 IBB nått)` : ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Totalt lönebaserat utrymme</div>
                    <div className="font-semibold text-brand">{formatKr(totals.lonebaserat)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Total ränta på omkostnadsbelopp</div>
                    <div className="font-semibold text-brand">{formatKr(totals.ranta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Totalt sparat utrymme (ingående)</div>
                    <div className="font-semibold text-brand">{formatKr(totals.sparat)}</div>
                  </div>
                  {totals.utdelning > 0 && (
                    <>
                      <div>
                        <div className="text-xs text-gray-600">Total planerad utdelning</div>
                        <div className="font-semibold text-brand">{formatKr(totals.utdelning)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Total kapitalskatt (20 % + 30 %)</div>
                        <div className="font-semibold text-brand">{formatKr(totals.kapitalskatt)}</div>
                      </div>
                      {totals.utdTjanst > 0 && (
                        <div className="col-span-2">
                          <div className="text-xs text-gray-600">Total tjänstedel (variabel skatt)</div>
                          <div className="font-semibold text-brand">{formatKr(totals.utdTjanst)}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-gray-600">Totalt nytt sparat till nästa år</div>
                        <div className="font-semibold text-brand">{formatKr(totals.nyttSparat)}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {results.map((r, idx) => (
              <BolagResult key={r.id} r={r} index={idx} total={results.length} />
            ))}
          </div>
        </div>

        <section className="mt-16 pt-10 border-t border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 inline-flex items-center gap-2">
              <BookOpen size={24} className="text-brand" />
              Saker att tänka på
            </h2>
            <p className="text-gray-500 mt-2 text-sm max-w-2xl mx-auto">
              Generella regler och förbehåll som påverkar din beräkning enligt 57 kap. inkomstskattelagen.
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-5">
            <InfoBox title="Flera fåmansbolag">
              Använd knappen <strong>"+ Lägg till företag"</strong> längst ner i vänstra kolumnen för att fylla i fler bolag. Grundbeloppet på 4 IBB ({formatKr(C.GRUNDBELOPP)}) gäller dig som person sammanlagt över alla dina fåmansbolag — om dina sammanlagda ägarandelar är över 100 % omfördelas det proportionellt. Lönebaserat, ränta och sparat utrymme räknas separat per bolag.
            </InfoBox>

            <InfoBox title="Takbeloppet">
              Utdelning över gränsbeloppet beskattas som tjänsteinkomst upp till takbeloppet om 90 IBB ({formatKr(C.TAKBELOPP_90_IBB)} för {UTDELNINGSAR}). Belopp däröver beskattas i kapital med 30 %. Takbeloppet gäller ägaren och närstående tillsammans under beskattningsåret — kalkylatorn räknar bara på din egen utdelning.
            </InfoBox>

            <InfoBox title="Dotterföretag i löneunderlaget">
              Löner från dotterföretag räknas in i löneunderlaget. Från och med inkomstår 2026 har dotterföretagsdefinitionen ändrats:
              <ul className="list-disc list-outside ml-5 mt-1 space-y-0.5">
                <li><strong>Aktiebolag:</strong> ny definition enligt aktiebolagslagen och årsredovisningslagen — i huvudsak majoritet av rösterna, kontroll via avtal, eller rätt att utse mer än hälften av styrelsen.</li>
                <li><strong>Handels- och kommanditbolag:</strong> oförändrat — kräver att moderföretaget direkt eller indirekt äger samtliga andelar.</li>
              </ul>
            </InfoBox>

            <InfoBox title="Kvalificerade andelar">
              Reglerna gäller endast kvalificerade andelar enligt 57 kap. IL. Aktierna är kvalificerade om delägaren eller närstående varit verksam i betydande omfattning i bolaget under beskattningsåret eller något av de fem föregående åren. Tidsperioden i denna kvalificeringsregel förkortas till fyra år från och med inkomstår 2027.
            </InfoBox>

            <InfoBox title="Karenstid">
              När ett bolag upphör att vara fåmansföretag förblir aktierna kvalificerade under en karenstid (s.k. trädabolag). Från och med inkomstår 2026 är karenstiden fyra år (tidigare fem). Reglerna om samma eller likartad verksamhet kan dock göra att karensen aldrig löper ut.
            </InfoBox>

            <InfoBox title="Ägande vid årets ingång">
              Årets gränsbelopp får enbart tillgodoräknas den som ägde aktierna vid ingången av inkomståret. Den som köper aktier under året får inte räkna med gränsbelopp för köpeåret — det görs först nästa år. Kalkylatorn förutsätter att du har ägt aktierna hela året före inkomståret; vid delägande under en del av året gäller andra regler för det lönebaserade utrymmet.
            </InfoBox>

            <InfoBox title="Sparat utdelningsutrymme">
              Sparat utdelningsutrymme får föras vidare till nästa inkomstår. Från och med deklarationen som lämnas 2027 (inkomstår 2026) räknas det inte längre upp med ränta — det förs vidare till nominellt värde. Det kan användas senare som kapitalbeskattad utdelning (20 %) eller som kapitalbeskattad del av kapitalvinst vid försäljning av aktierna.
            </InfoBox>

            <InfoBox title="Endast utdelning, inte kapitalvinst">
              Kalkylatorn räknar gränsbelopp för utdelning. Vid försäljning av aktierna (kapitalvinst) gäller delvis andra regler — bl.a. ett separat takbelopp om 100 IBB ({formatKr(100 * C.IBB_2026)} för {UTDELNINGSAR}) och övergångsregler för aktier anskaffade före 1990/1992 (index- och kapitalunderlagsreglerna, som tas bort från inkomstår 2029).
            </InfoBox>

            <InfoBox title="Utomståenderegeln">
              Om en utomstående (utanför närståendekretsen) äger ≥ 30 % av aktierna i bolaget och har rätt till motsvarande utdelning, kan delägarens aktier räknas som icke-kvalificerade. Bedömningsperioden är fem år bakåt (kortas till fyra år från inkomstår 2027). Är aktierna icke-kvalificerade gäller inte 3:12-reglerna och utdelningen beskattas direkt med 25 % i kapital — kalkylatorn antar att dina aktier är kvalificerade.
            </InfoBox>
          </div>
        </section>

        <section className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed text-center max-w-3xl mx-auto">
            <strong className="text-gray-700">Ansvarsfriskrivning.</strong> Denna kalkylator är ett rådgivningsstöd och ersätter inte individuell skatterådgivning. Resultaten beräknas utifrån inmatade uppgifter och gällande regler enligt 57 kap. inkomstskattelagen. Verktyget tar inte hänsyn till alla möjliga undantag eller specialregler. Kontrollera alltid mot Skatteverkets vägledning innan slutliga beslut fattas.
          </p>
        </section>
      </div>
    </div>
  );
}
