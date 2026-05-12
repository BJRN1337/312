// Konstanter och beräkningslogik för 3:12-kalkylatorn.
// Värdena är verifierade mot Skatteverkets tabeller för inkomstår 2026.

export const C = {
  IBB_2025: 80600,            // året före utdelningsåret — bas för grundbelopp och löneavdrag
  IBB_2026: 83400,            // utdelningsåret — bas för takbeloppet 90 IBB
  GRUNDBELOPP: 322400,        // 4 × IBB 2025
  LONEAVDRAG: 644800,         // 8 × IBB 2025
  TAKBELOPP_90_IBB: 7506000,  // 90 × IBB 2026
  SLR_30_NOV_2025: 0.0255,
  RANTESATS_OMKOST: 0.1155,
  OMKOST_FRI_NIVA: 100000,
};

export const UTDELNINGSAR = 2026;

export const calculateBolag = (b, totalOwnership, exceedsCap) => {
  const ownFrac = (b.ownership || 0) / 100;

  // Grundbelopp — per bolag, omfördelas över alla användarens bolag om sammanlagt > 4 IBB
  const grundbeloppShare = totalOwnership > 0 ? ownFrac / totalOwnership : 0;
  const grundbeloppFordelat = exceedsCap
    ? C.GRUNDBELOPP * grundbeloppShare
    : C.GRUNDBELOPP * ownFrac;

  // Lönebaserat utrymme
  // Makar: gemensam beräkning på parets sammanlagda ägarandel
  const spouseFrac = b.hasSpouse ? (b.spouseOwnership || 0) / 100 : 0;
  const groupOwnership = ownFrac + spouseFrac;
  const andelAvLoneunderlag = (b.totalSalary || 0) * groupOwnership;
  const efterLoneavdrag = Math.max(0, andelAvLoneunderlag - C.LONEAVDRAG);
  const lonebaseratGruppen = efterLoneavdrag * 0.5;
  const memberShareOfGroup = groupOwnership > 0 ? ownFrac / groupOwnership : 0;
  const lonebaseratFordelat = lonebaseratGruppen * memberShareOfGroup;

  // Takregel — 50 × högsta lönen i närståendekretsen (användaren anger den höga)
  const takregel = (b.salary || 0) * 50;
  const takregelTillampad = lonebaseratFordelat > takregel;
  const lonebaseratFinal = Math.min(lonebaseratFordelat, takregel);

  // Ränta på omkostnadsbelopp över 100 000 kr
  const omkostOverGrans = Math.max(0, (b.costBasis || 0) - C.OMKOST_FRI_NIVA);
  const rantaOmkost = omkostOverGrans * C.RANTESATS_OMKOST;

  // Gränsbelopp
  const aretsGransbelopp = grundbeloppFordelat + lonebaseratFinal + rantaOmkost;
  const totaltGransbelopp = aretsGransbelopp + (b.savedAmount || 0);

  // Beskattning av planerad utdelning
  const utdelning = b.planeradUtdelning || 0;
  const utdInomGrans = Math.min(utdelning, totaltGransbelopp);
  const utdOverGrans = Math.max(0, utdelning - totaltGransbelopp);
  const utdTjanst = Math.min(utdOverGrans, C.TAKBELOPP_90_IBB);
  const utdOverTak = Math.max(0, utdOverGrans - C.TAKBELOPP_90_IBB);
  const skattInomGrans = utdInomGrans * 0.20;
  const skattOverTak = utdOverTak * 0.30;
  const totalKapitalskatt = skattInomGrans + skattOverTak;
  const nyttSparat = Math.max(0, totaltGransbelopp - utdelning);

  return {
    ...b,
    ownFrac,
    grundbeloppShare,
    grundbeloppFordelat,
    groupOwnership,
    andelAvLoneunderlag,
    efterLoneavdrag,
    lonebaseratGruppen,
    memberShareOfGroup,
    lonebaseratFordelat,
    takregel,
    takregelTillampad,
    lonebaseratFinal,
    omkostOverGrans,
    rantaOmkost,
    aretsGransbelopp,
    totaltGransbelopp,
    utdelning,
    utdInomGrans,
    utdOverGrans,
    utdTjanst,
    utdOverTak,
    skattInomGrans,
    skattOverTak,
    totalKapitalskatt,
    nyttSparat,
  };
};

export const calculateAll = (bolag) => {
  const totalOwnership = bolag.reduce((sum, b) => sum + (b.ownership || 0), 0) / 100;
  const exceedsCap = totalOwnership > 1;
  return {
    totalOwnership,
    exceedsCap,
    results: bolag.map((b) => calculateBolag(b, totalOwnership, exceedsCap)),
  };
};

export const aggregate = (results) => results.reduce(
  (acc, r) => ({
    grundbelopp: acc.grundbelopp + r.grundbeloppFordelat,
    lonebaserat: acc.lonebaserat + r.lonebaseratFinal,
    ranta: acc.ranta + r.rantaOmkost,
    aretsGransbelopp: acc.aretsGransbelopp + r.aretsGransbelopp,
    sparat: acc.sparat + (r.savedAmount || 0),
    totaltGransbelopp: acc.totaltGransbelopp + r.totaltGransbelopp,
    utdelning: acc.utdelning + r.utdelning,
    utdInomGrans: acc.utdInomGrans + r.utdInomGrans,
    utdTjanst: acc.utdTjanst + r.utdTjanst,
    utdOverTak: acc.utdOverTak + r.utdOverTak,
    kapitalskatt: acc.kapitalskatt + r.totalKapitalskatt,
    nyttSparat: acc.nyttSparat + r.nyttSparat,
  }),
  { grundbelopp: 0, lonebaserat: 0, ranta: 0, aretsGransbelopp: 0, sparat: 0, totaltGransbelopp: 0, utdelning: 0, utdInomGrans: 0, utdTjanst: 0, utdOverTak: 0, kapitalskatt: 0, nyttSparat: 0 }
);
