// Beräkningstester mot Skatteverkets räkneexempel och tidigare överenskomna scenarier.
// Kör: node test/calc.test.mjs

import { C, calculateAll, aggregate } from '../src/calc.js';

let pass = 0;
let fail = 0;
const failures = [];

const fmt = (n) => Math.round(n).toLocaleString('sv-SE').replace(/,/g, ' ');

// Tolerans 1 kr för avrundningsskillnader
const approx = (actual, expected, tol = 1) => Math.abs(actual - expected) <= tol;

const expect = (label, actual, expected, tol = 1) => {
  const ok = approx(actual, expected, tol);
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}: ${fmt(actual)}`);
  } else {
    fail++;
    failures.push(`${label}: förväntat ${fmt(expected)}, fick ${fmt(actual)}`);
    console.log(`  ✗ ${label}: förväntat ${fmt(expected)}, fick ${fmt(actual)}`);
  }
};

const run = (bolag) => calculateAll(bolag);
const bolag = (overrides) => ({
  id: Math.random(),
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

// ============================================================
// A. SKATTEVERKETS RÄKNEEXEMPEL
// ============================================================

console.log('\n--- A1. Ismail: 25 % i Spjutvision + 33 % i Klarafront ---');
{
  const { results } = run([
    bolag({ namn: 'Spjutvision AB', ownership: 25 }),
    bolag({ namn: 'Klarafront AB', ownership: 33 }),
  ]);
  expect('Spjutvision grundbelopp', results[0].grundbeloppFordelat, 80600);
  expect('Klarafront grundbelopp', results[1].grundbeloppFordelat, 106392);
}

console.log('\n--- A2. Tove: 25 % + 75 % + 100 %, omfördelning ---');
{
  const { exceedsCap, results } = run([
    bolag({ namn: 'Bullbageriet AB', ownership: 25 }),
    bolag({ namn: 'Tullärt AB', ownership: 75 }),
    bolag({ namn: 'Markisexpert AB', ownership: 100 }),
  ]);
  expect('exceedsCap', exceedsCap ? 1 : 0, 1);
  expect('Bullbageriet grundbelopp', results[0].grundbeloppFordelat, 40300);
  expect('Tullärt grundbelopp', results[1].grundbeloppFordelat, 120900);
  expect('Markisexpert grundbelopp', results[2].grundbeloppFordelat, 161200);
  const total = results.reduce((s, r) => s + r.grundbeloppFordelat, 0);
  expect('summan av grundbeloppen = max 4 IBB', total, C.GRUNDBELOPP);
}

console.log('\n--- A3. Agnes (70 %), ej makar, löneunderlag 4 mkr ---');
{
  const { results } = run([
    bolag({ ownership: 70, totalSalary: 4_000_000, salary: 400_000 }),
  ]);
  expect('Agnes lönebaserat utrymme', results[0].lonebaseratFordelat, 1077600);
  expect('Agnes takregel slår ej in', results[0].takregelTillampad ? 1 : 0, 0);
}

console.log('\n--- A4. Birger (30 %), ej makar ---');
{
  const { results } = run([
    bolag({ ownership: 30, totalSalary: 4_000_000, salary: 300_000 }),
  ]);
  expect('Birger lönebaserat utrymme', results[0].lonebaseratFordelat, 277600);
}

console.log('\n--- A5. Amy (60 %) makar med Gedion (40 %) ---');
{
  // Amy använder Amys lön (500k) som "din lön" eftersom hon är högst i kretsen
  const { results: amyR } = run([
    bolag({ ownership: 60, totalSalary: 4_000_000, salary: 500_000, hasSpouse: true, spouseOwnership: 40 }),
  ]);
  expect('Amy lönebaserat (paret 1 677 600 × 0,6)', amyR[0].lonebaseratFordelat, 1006560);
  expect('Amy gemensam beräkning groupOwnership = 1.0', amyR[0].groupOwnership, 1);

  // Gedion fyller i 40 % egen och 60 % maka. Använder också Amys lön 500k (max i kretsen).
  const { results: gedionR } = run([
    bolag({ ownership: 40, totalSalary: 4_000_000, salary: 500_000, hasSpouse: true, spouseOwnership: 60 }),
  ]);
  expect('Gedion lönebaserat (paret 1 677 600 × 0,4)', gedionR[0].lonebaseratFordelat, 671040);
}

console.log('\n--- A6. Helle: omkostnadsbelopp 250 000 ---');
{
  const { results } = run([
    bolag({ ownership: 100, costBasis: 250_000 }),
  ]);
  expect('Helle ränta på omkostnadsbelopp', results[0].rantaOmkost, 17325);
}

console.log('\n--- A7. Valter: full beräkning ---');
{
  const { results } = run([
    bolag({ ownership: 100, totalSalary: 1_000_000, salary: 600_000, costBasis: 25_000, savedAmount: 750_000 }),
  ]);
  expect('Valter grundbelopp', results[0].grundbeloppFordelat, 322400);
  expect('Valter lönebaserat utrymme', results[0].lonebaseratFordelat, 177600);
  expect('Valter ränta (omkostnad under tröskel)', results[0].rantaOmkost, 0);
  expect('Valter årets gränsbelopp', results[0].aretsGransbelopp, 500000);
  expect('Valter totalt gränsbelopp', results[0].totaltGransbelopp, 1250000);
}

// ============================================================
// B. MULTI-BOLAG
// ============================================================

console.log('\n--- B2. Användarens scenario: 100 % bolag A + 50 % bolag B ---');
{
  const { exceedsCap, results } = run([
    bolag({ namn: 'A', ownership: 100 }),
    bolag({ namn: 'B', ownership: 50 }),
  ]);
  expect('exceedsCap (150 % > 100 %)', exceedsCap ? 1 : 0, 1);
  expect('A grundbelopp (322 400 × 100/150)', results[0].grundbeloppFordelat, 214933);
  expect('B grundbelopp (322 400 × 50/150)', results[1].grundbeloppFordelat, 107467);
  const total = results.reduce((s, r) => s + r.grundbeloppFordelat, 0);
  expect('summa = 4 IBB-taket', total, C.GRUNDBELOPP);
}

console.log('\n--- B-extra. 30 % + 30 % (under tak, ingen omfördelning) ---');
{
  const { exceedsCap, results } = run([
    bolag({ ownership: 30 }),
    bolag({ ownership: 30 }),
  ]);
  expect('exceedsCap (60 % < 100 %)', exceedsCap ? 1 : 0, 0);
  expect('första bolaget: 322 400 × 0,3', results[0].grundbeloppFordelat, 96720);
  expect('andra bolaget: 322 400 × 0,3', results[1].grundbeloppFordelat, 96720);
}

// ============================================================
// C. UTDELNINGS-ZONER (beskattning)
// ============================================================

console.log('\n--- C1. Valter, utdelning 0 ---');
{
  const { results } = run([
    bolag({ ownership: 100, totalSalary: 1_000_000, salary: 600_000, costBasis: 25_000, savedAmount: 750_000, planeradUtdelning: 0 }),
  ]);
  expect('Inget utdelat → outnyttjat = totalt gränsbelopp', results[0].nyttSparat, 1250000);
  expect('Ingen kapitalskatt', results[0].totalKapitalskatt, 0);
}

console.log('\n--- C2. Valter, utdelning 500 000 (inom gränsbelopp) ---');
{
  const { results } = run([
    bolag({ ownership: 100, totalSalary: 1_000_000, salary: 600_000, costBasis: 25_000, savedAmount: 750_000, planeradUtdelning: 500_000 }),
  ]);
  expect('Hela inom gränsbelopp', results[0].utdInomGrans, 500000);
  expect('Ingen tjänst', results[0].utdTjanst, 0);
  expect('Inget över tak', results[0].utdOverTak, 0);
  expect('Kapitalskatt 20 %', results[0].totalKapitalskatt, 100000);
  expect('Nytt sparat till nästa år', results[0].nyttSparat, 750000);
}

console.log('\n--- C3. Valter, utdelning 10 mkr (över både gränsbelopp och takbelopp) ---');
{
  const { results } = run([
    bolag({ ownership: 100, totalSalary: 1_000_000, salary: 600_000, costBasis: 25_000, savedAmount: 750_000, planeradUtdelning: 10_000_000 }),
  ]);
  expect('Inom gränsbelopp = totalt gränsbelopp', results[0].utdInomGrans, 1250000);
  expect('Tjänstedel = 90 IBB (kapad vid taket)', results[0].utdTjanst, 7506000);
  expect('Över tak = 10 mkr − 1,25 mkr − 7,506 mkr', results[0].utdOverTak, 1244000);
  expect('Skatt inom gränsbelopp (20 %)', results[0].skattInomGrans, 250000);
  expect('Skatt över tak (30 %)', results[0].skattOverTak, 373200);
  expect('Total kapitalskatt', results[0].totalKapitalskatt, 623200);
  expect('Nytt sparat = 0', results[0].nyttSparat, 0);
}

// ============================================================
// D. AGGREGAT
// ============================================================

console.log('\n--- D. Aggregerade totaler för B2-scenariot ---');
{
  const { results } = run([
    bolag({ namn: 'A', ownership: 100 }),
    bolag({ namn: 'B', ownership: 50 }),
  ]);
  const totals = aggregate(results);
  expect('Aggregerat grundbelopp = max 4 IBB', totals.grundbelopp, C.GRUNDBELOPP);
  expect('Aggregerat totalt gränsbelopp', totals.totaltGransbelopp, C.GRUNDBELOPP);
}

// ============================================================
// SAMMANFATTNING
// ============================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTAT: ${pass} godkända, ${fail} misslyckade`);
if (fail > 0) {
  console.log('\nMisslyckade tester:');
  failures.forEach((f) => console.log(`  ${f}`));
  process.exit(1);
}
console.log('Alla matematik-tester godkända ✓');
