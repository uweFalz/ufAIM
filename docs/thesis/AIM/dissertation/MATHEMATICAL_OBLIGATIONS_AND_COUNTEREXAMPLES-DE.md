# AIM-Dissertation: Mathematische Pflichten und nähere Gegenbelege

## Umfang und Statusvokabular

Dieses DISS-04-Arbeitsdokument prüft die achtzehn in
`PROPOSITION_INVENTORY.md` als `SCI-MATH` klassifizierten Propositionen mit
Fokus auf C3. Es ändert weder Propositionen noch freigegebene Kernel-Bedeutung.
Ein mathematischer Status wird nur vergeben, wenn die Aussage tatsächlich
mathematisch ist:

- `proved`: Das Ergebnis folgt unter den erklärten Voraussetzungen;
- `bounded derivation`: Eine Rechnung gilt nur unter expliziten lokalen
  Annahmen und ist kein universeller Satz;
- `revise`: Die Aussage ist in aktueller Form falsch, unterbestimmt oder zu weit;
- `reclassify`: Die Aussage ist Definition, Ingenieurvertrag oder methodische
  Behauptung und darf nicht als Theorem erscheinen.

## Auditmatrix

| ID | Status | Mathematische Pflicht und Befund | Erforderliche Thesis-Aktion |
|---|---|---|---|
| P024 | `proved` | Für integrierbares \(\kappa\) definieren die beiden Integrale \(\theta\) und \(\gamma\) aus den Anfangsdaten eindeutig als absolut stetige Funktionen. Der vorhandene Beweis ist relativ zu den beiden Axiomen vollständig. | „Hinreichend regulär“ bei Einbindung durch eine explizite Regularitätsklasse ersetzen. |
| P051 | `bounded derivation` | Dies ist die bereits durch P024 bewiesene Rekonstruktionskette, kein zweites Theorem. | In Korollar oder erläuternde Zusammenfassung mit Verweis auf P024 umwandeln. |
| P053 | `revise` | „Jeder Übergangsbogen“ ist ohne Regularität und reguläre Parametrisierung falsch. Ecken besitzen keine klassische Krümmung; beliebige Parameter sind keine Bogenlänge \(s\). | Auf reguläre ebene \(C^2\)-Kurven in Bogenlängenparametrisierung oder \(W^{2,1}\)-Kurven mit fast überall definierter Krümmung begrenzen. |
| P055 | `bounded derivation` | Die Formel ist eine affine Skalierungsdefinition. Sie erfüllt die Endkrümmungen nur für \(L>0\), \(\widehat\kappa(0)=0\) und \(\widehat\kappa(1)=1\). | Als Definition kennzeichnen und Endpunkt-/Gebietsvoraussetzungen nennen. |
| P056 | `proved` | Für \(J=\int_0^L(\kappa')^2ds\) auf der erklärten affinen Teilmenge von \(H^1\) ergibt die erste Variation \(\int\kappa'\eta'=0\) für alle \(\eta\in H_0^1\), also distributionell \(\kappa''=0\). | Kurzen schwachen Euler–Lagrange-Beweis ergänzen. |
| P057 | `proved` | Aus P056 folgt \(\kappa=as+b\); die Randwerte liefern \(b=0\), \(a=\kappa_1/L\). Strikte Konvexität liefert Eindeutigkeit. Alternativ folgt aus Cauchy–Schwarz \(J\ge\kappa_1^2/L\) mit Gleichheit nur für konstantes \(\kappa'\). | Beweis ergänzen und „eindeutiger Minimierer“ schreiben. |
| P058 | `revise` | \(J_2\) ist auf der vorherigen \(H^1\)-Menge nicht definiert; Randbedingungen des Problems vierter Ordnung fehlen. | Eine zulässige \(H^2\)-Menge definieren. Bei festem \(\kappa\) und \(\kappa'\) an beiden Enden gilt schwach \(\kappa^{(4)}=0\); andere Randwahl erzeugt natürliche Randbedingungen. |
| P059 | `bounded derivation` | Einsetzen von \(\phi\equiv0\) entfernt \(\phi\) als Variable, aber im Funktional können Gleichgewichts-, Ruck- und Gewichtsterme verbleiben. „Reine Krümmung“ bedeutet nur krümmungsabhängig, nicht ausschließlich das frühere \(J_\kappa\). | Als Einsetzungs-Korollar formulieren und verbleibende Terme nennen. |
| P060 | `bounded derivation` | Aus der lokalen Definition \(a_{\rm eff}=v^2\kappa-g\sin\phi\) folgt die Gleichung bei Nullsetzung algebraisch. „Perfekt ausgeglichen“ ist eine Ingenieurdeutung im vereinfachten Konstantgeschwindigkeits-/Vorzeichenmodell. | Identität und annahmenabhängige Deutung trennen. |
| P061 | `revise` | Die Integrale rekonstruieren ebene Richtung und Position, nicht „alle Zustandsvariablen“; Profil, Cant, Chainage und Realisierung benötigen weitere Gesetze/Operatoren. | Proposition auf pose2-Variablen begrenzen. |
| P062 | `proved` | Ist \(\kappa(\cdot,p)\) nach \(p\) differenzierbar und erlaubt eine lokal integrierbare Majorante Ableiten unter dem Integral, folgt die Formel aus der Leibniz-Regel. | Dominanz-/Differenzierbarkeitsvoraussetzungen ergänzen. |
| P063 | `proved` | Kettenregel auf \((\cos\theta,\sin\theta)\) anwenden und unter P062-Voraussetzungen unter dem Integral differenzieren. | Zweizeilige Herleitung und Voraussetzungen ergänzen. |
| P064 | `revise` | P062–P063 liefern exakte Ableitungen nur für differenzierbare Parametrisierungen und glatte Residuen-/Constraint-Kompositionen. Nichtdifferenzierbare Admission-Logik, Active-Set-Wechsel oder Blackbox-Operatoren besitzen nicht automatisch exakte Jacobi-Matrizen. | Auf den glatten Rekonstruktionsblock begrenzen; nicht das gesamte Optimierungsproblem beanspruchen. |
| P065 | `revise` | Die Formel gilt nur für einen Formparameter \(p\) von \(\widehat\kappa\) bei festem \(L,\kappa_0,\kappa_1\). Für den vorher erklärten Parametervektor ist sie falsch: Endpunkt- und Längenableitungen besitzen Zusatzterme. | Auf \(p\in\mathbf T\) begrenzen oder getrennte Endpunkt-/Längenableitungen angeben. |
| P067 | `revise` | Konvergenz von \(\gamma_{k+1}=\mathcal A(\gamma_k)\) allein impliziert bei unstetigem \(\mathcal A\) keinen Fixpunkt. | Stetigkeit (oder abgeschlossenen Graphen/sequentielle Stetigkeit) im Grenzwert ergänzen; dann beidseitig Grenzwerte bilden. |
| P072 | `reclassify` | „Der physische Entwurfsraum ist das Bild des Realisierungsoperators“ ist eine Mengendefinition, kein entdecktes mathematisches Ergebnis. | Proposition durch Definition ersetzen; empirische Angemessenheit von \(\mathcal R\) bleibt separater Anspruch. |
| P083 | `reclassify` | Persistenz und Ingenieurautorität sind normative Verantwortungsansprüche. Nur die pose2-Rekonstruktion ist mathematisch und bereits durch P024 abgedeckt. | Als `CONTRACT` klassifizieren; durch Kernel-Trace und semantisches Wiederöffnen statt Beweis validieren. |
| P084 | `reclassify` | Eine qualifizierte Auswertung existiert erst nach Wahl von Metrik-, Frame-, Transport-, Spurweiten- und Konventionsoperatoren. Erhaltung von Alignment-Referenz und Provenienz ist Vertrag, keine mathematische Folge aus \(\kappa,h,u\). | Als `CONTRACT` klassifizieren; begrenztes Konstruktionsrezept separat behalten. |

## Geschlossene Beweise und Reparaturlemmata

### Schwacher Minimierer für P056–P057

Sei \(\mathcal A=\{\kappa\in H^1(0,L):\kappa(0)=0,
\kappa(L)=\kappa_1\}\). Für jedes \(\eta\in H_0^1(0,L)\) liefert
Stationarität

\[
0=\left.\frac{d}{d\epsilon}J[\kappa^*+\epsilon\eta]
\right|_{\epsilon=0}=2\int_0^L\kappa^{*\prime}\eta'\,ds.
\]

Somit gilt distributionell \(\kappa^{*\prime\prime}=0\). Die Randwerte
liefern \(\kappa^*(s)=\kappa_1s/L\). Außerdem gilt

\[
\kappa_1^2=\left(\int_0^L\kappa' ds\right)^2
\le L\int_0^L(\kappa')^2ds,
\]

mit Gleichheit genau bei konstantem \(\kappa'\). Dies beweist Existenz und
Eindeutigkeit, nicht eine über dieses Funktional hinausgehende
Ingenieuroptimalität.

### Reparatursatz für P058

Auf einer affinen Teilmenge von \(H^2(0,L)\), auf der \(\kappa\) und
\(\kappa'\) an beiden Enden fest sind, erfüllen Variationen
\(\eta=\eta'=0\) am Rand. Zweimaliges partielles Integrieren von
\(2\int_0^L\kappa''\eta''ds=0\) ergibt schwach
\(\kappa^{(4)}=0\). Das ist ein kubisches Polynomresultat für genau dieses
Problem; aus der aktuellen \(H^1\)-Menge folgt es nicht.

### Differenzierungslemmata für P062–P065

Für eine differenzierbare Familie \(\kappa(s,p)\) ergibt dominiertes
Differenzieren

\[
\partial_p\theta(s,p)=\int_0^s\partial_p\kappa(\sigma,p)d\sigma,
\]

und die Kettenregel liefert das Vektorintegral aus P063. Für
\(\kappa=\kappa_0+(\kappa_1-\kappa_0)
\widehat\kappa(s/L,\mathbf T)\) gilt P065 nur für
\(p\in\mathbf T\). Dagegen ist

\[
\partial_{\kappa_0}\kappa=1-\widehat\kappa,
\qquad
\partial_{\kappa_1}\kappa=\widehat\kappa,
\]

und \(\partial_L\kappa\) differenziert zusätzlich \(s/L\). Dies widerlegt
die universelle Formulierung direkt.

### Fixpunktreparatur für P067

Aus \(\gamma_k\to\gamma_*\),
\(\gamma_{k+1}=\mathcal A(\gamma_k)\) und Stetigkeit von \(\mathcal A\) in
\(\gamma_*\) folgt
\(\gamma_*=\lim\gamma_{k+1}=\lim\mathcal A(\gamma_k)
=\mathcal A(\gamma_*)\). Ohne Stetigkeit setze auf \(\mathbb R\)
\(\mathcal A(0)=1\) und \(\mathcal A(x)=x/2\) für \(x\ne0\): Eine Bahn kann
gegen null konvergieren, obwohl null kein Fixpunkt ist.

## Nähere Gegenbelege aus Originalquellen und Standards

| Quelle | Gegenbeleg zum vorläufigen Anspruch | Konsequenz |
|---|---|---|
| buildingSMART, [IfcAlignmentCantSegment, IFC 4.3.2.0](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegment.htm) | Das offizielle Schema speichert bereits `StartCantLeft`, `EndCantLeft`, `StartCantRight` und `EndCantRight` auf Segmenten entlang des horizontalen Alignments. | Explizite linke/rechte Cant-Endwerte und ihre Längssegmentierung sind Stand der Technik und tragen keine C3-Neuheit. |
| buildingSMART, [IfcAlignmentCantSegmentTypeEnum](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegmentTypeEnum.htm) | Der Standard definiert Cant-Familien und behandelt ausdrücklich verkürzte Rampen und Scherenrampen. | Nichtgemeinsame Schienenbewegung und benannte Cant-Übergangsfamilien sind in AIM nicht neu. |
| S. Bischof und G. Schenner, [Rail Topology Ontology: A Rail Infrastructure Base Ontology](https://arxiv.org/abs/2107.04378), 2021 | RTO liefert standardausgerichtete Identität, intrinsische Koordinaten, Orientierung, Topologie und Integration getrennter Bahndatenquellen. | C1/C3 dürfen Bahnidentität, intrinsische Positionierung oder semantische Integration nicht allgemein beanspruchen; AIM muss seine engere konstruktive Verantwortungsgrenze zeigen. |
| J. Seo et al., [Design of Railway Track Model with Three-Dimensional Alignment Based on Extended Industry Foundation Classes](https://doi.org/10.3390/app10103649), *Applied Sciences* 10(10), 2020, 3649 | Die Originalimplementierung kombiniert horizontales und vertikales Alignment und berechnet cant-bezogene Schwellenorientierung; zugleich berichtet sie semantischen Informationsverlust im damaligen Austauschmodell. | 3D-Komposition ist Stand der Technik; bedeutungserhaltender semantischer Austausch bleibt empirische Lücke statt angenommener Neuheit. |

## C3-Entscheidung nach DISS-04

**Ergebnis: `survives with further reformulation`.** C3 kann keine Neuheit für
Krümmungsrekonstruktion, gemeinsamen Distance-along-Parameter, kombinierten
Horizontal-/Vertikal-/Cant-Zustand, explizite linke/rechte Cant-Werte, benannte
Cant-Familien oder pose3-Erzeugung beanspruchen. Für alles bestehen nahe
Vorleistungen.

Verbleibender bedingter Anspruch ist Verantwortung und Erhaltung: AIM behandelt
zugelassene linke/rechte Schienengesetze als konstruktive Autorität, hält
midpoint, cross-level und common offset abgeleitet, trennt intrinsische Position
von Chainage und qualifizierter Realisierung und prüft, ob diese Rollen
folgenreiche Änderung und semantisches Wiederöffnen überstehen. Ohne Nachweis
eines durch diese vollständige Grenze verhinderten Fehlers in der realen
Fallstudie kann auch dies auf Implementierungssynthese sinken.

## Einbindungsgate

Kein geprüfter Anspruch darf in den Beitragsprosatext gelangen, bevor P053,
P058, P061, P064, P065 und P067 repariert sowie P072, P083 und P084
umklassifiziert wurden. Normative Verträge brauchen Kernel-Trace und
Konformitätsevidenz, keine künstlichen Beweise. Eingebundene EN/DE-Quellen
wurden in diesem Paket nicht geändert.
