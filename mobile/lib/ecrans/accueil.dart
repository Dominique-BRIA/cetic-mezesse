import 'package:flutter/material.dart';

import '../api.dart';
import '../etat.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'coquille.dart';

class EcranAccueil extends StatelessWidget {
  const EcranAccueil({super.key});

  @override
  Widget build(BuildContext context) {
    final e = Etat.i;
    final ouverte = e.sequenceOuverte;
    return Charge<List>(
      charger: () async => [
        await Api.i.get('/notes/avancement'),
        if (!e.estProf) await Api.i.get('/statistiques/etablissement?periode=${_derniereClose(ouverte)}'),
      ],
      construire: (context, d, recharger) {
        final avancement = d[0] as Map;
        final matieres = (avancement['matieres'] as List).cast<Map>();
        return Defilement(rafraichir: () async {
          await e.chargerAnnees();
          await recharger();
        }, enfants: [
          EnTete(
            titre: 'Bonjour, ${e.utilisateur?['prenom']}',
            description: ouverte != null
                ? 'Année ${e.annee?['libelle']} · saisie de la séquence ${ouverte['numero']} ouverte'
                : 'Année ${e.annee?['libelle']} · aucune séquence ouverte à la saisie',
            actions: [
              if (e.estProf && ouverte != null)
                FilledButton.icon(
                  onPressed: () => destinationCourante.value = 'saisie',
                  icon: const Icon(Icons.edit_note),
                  label: const Text('Saisir des notes'),
                ),
            ],
          ),
          if (e.estProf) _mesMatieres(context, avancement, matieres) else ..._direction(context, d[1] as Map, matieres, ouverte),
        ]);
      },
    );
  }

  static String _derniereClose(Map? ouverte) {
    final s = Etat.i.sequences.reversed.where((s) => s['saisieOuverte'] != true && (ouverte == null || (s['numero'] as int) < (ouverte['numero'] as int)));
    return 'S${s.isEmpty ? 1 : s.first['numero']}';
  }

  Widget _mesMatieres(BuildContext context, Map avancement, List<Map> matieres) {
    final sequences = (avancement['sequences'] as List).cast<Map>();
    final c = context.c;
    if (matieres.isEmpty) return const Carte(enfant: Vide('Aucune matière ne vous est attribuée', texte: 'Le Surveillant Général affecte les matières.'));
    return Carte(
      titre: 'Mes matières',
      sansMarge: true,
      enfant: Column(children: [
        for (final m in matieres) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${m['nom']} · ${m['classe']['nom']}', style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Wrap(spacing: 10, runSpacing: 4, children: [
                for (final s in sequences)
                  Builder(builder: (_) {
                    final n = (m['saisies'] as Map)[s['id']] as int? ?? 0;
                    final eff = m['effectif'] as int;
                    final couleur = n == 0 ? c.encre3 : (n < eff ? c.alerte : c.succes);
                    return Text('S${s['numero']} $n/$eff', style: TextStyle(fontSize: 12.5, color: couleur, fontWeight: FontWeight.w500));
                  }),
              ]),
            ]),
          ),
          const Divider(),
        ],
      ]),
    );
  }

  List<Widget> _direction(BuildContext context, Map stats, List<Map> matieres, Map? ouverte) {
    final t = stats['totaux'] as Map;
    final r = stats['resume'] as Map;
    final premier = (stats['premier'] as List).cast<Map>();
    // Avancement de la saisie de la séquence ouverte, par classe
    final parClasse = <String, List<int>>{}; // nom → [saisies, attendues, matières, complètes]
    if (ouverte != null) {
      for (final m in matieres) {
        final v = parClasse.putIfAbsent(m['classe']['nom'] as String, () => [0, 0, 0, 0]);
        final n = (m['saisies'] as Map)[ouverte['id']] as int? ?? 0;
        final eff = m['effectif'] as int;
        v[0] += n;
        v[1] += eff;
        v[2] += 1;
        if (eff > 0 && n >= eff) v[3] += 1;
      }
    }
    return [
      GrilleIndicateurs(enfants: [
        Indicateur(libelle: 'Élèves', valeur: '${t['eleves']}', detail: '${t['filles']} filles · ${t['garcons']} garçons'),
        Indicateur(libelle: 'Classes', valeur: '${t['classes']}'),
        Indicateur(libelle: 'Enseignants', valeur: '${t['enseignants']}'),
        Indicateur(libelle: 'Renvoyés', valeur: '${t['renvoyes']}'),
      ]),
      Carte(
        titre: ouverte != null ? 'Saisie de la séquence ${ouverte['numero']}' : 'Saisie des notes',
        enfant: ouverte == null
            ? const Text("Aucune séquence n'est ouverte : les professeurs ne peuvent pas saisir.")
            : Column(children: [
                for (final MapEntry(key: nom, value: v) in parClasse.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(nom, style: const TextStyle(fontWeight: FontWeight.w600))),
                        Text('${v[3]}/${v[2]} matières · ${v[0]}/${v[1]}', style: TextStyle(fontSize: 12.5, color: context.c.encre2)),
                      ]),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: v[1] == 0 ? 0 : v[0] / v[1],
                          minHeight: 6,
                          backgroundColor: context.c.surface2,
                          color: v[0] >= v[1] ? context.c.succes : Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ]),
                  ),
              ]),
      ),
      Carte(
        titre: 'Résultats de la séquence ${_derniereClose(ouverte).substring(1)}',
        enfant: Column(children: [
          LigneInfo('Moyenne générale', note(r['moyenne'] as num?), gras: true),
          LigneInfo('Taux de réussite', pourcent(r['tauxReussite'] as num?), gras: true),
          LigneInfo('Premier', premier.isEmpty ? '—' : premier.map((p) => '${nom(p)} (${p['classe']['nom']})').join('\n')),
          LigneInfo('Meilleure classe', stats['premiereClasse'] == null ? '—' : '${stats['premiereClasse']['nom']} (${note(stats['premiereClasse']['moyenneGenerale'] as num?)})'),
        ]),
      ),
    ];
  }
}
