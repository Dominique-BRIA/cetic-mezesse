import 'package:flutter/material.dart';

import '../api.dart';
import '../etat.dart';
import '../theme.dart';
import '../widgets.dart';
import 'organisation.dart';

// ---------------- Années et séquences ----------------

class EcranAnnees extends StatefulWidget {
  const EcranAnnees({super.key});
  @override
  State<EcranAnnees> createState() => _EcranAnneesState();
}

class _EcranAnneesState extends State<EcranAnnees> {
  Future<void> _rafraichir() => Etat.i.chargerAnnees();

  Future<void> _nouvelle() async {
    final e = Etat.i;
    final debut = e.annees.isEmpty ? DateTime.now().year : int.parse((e.annees.first['libelle'] as String).substring(0, 4)) + 1;
    final libelle = TextEditingController(text: '$debut-${debut + 1}');
    String? copier = e.annees.isEmpty ? null : e.annees.first['id'] as String;
    var activer = false;
    String? cree;
    final ok = await feuilleFormulaire(
      context,
      'Nouvelle année scolaire',
      (ctx, maj) => Column(children: [
        TextField(controller: libelle, decoration: const InputDecoration(labelText: 'Libellé', helperText: 'Les 6 séquences sont créées automatiquement')),
        const SizedBox(height: 12),
        Choix<String>(
          libelle: "Reprendre l'organisation de",
          valeur: copier ?? '',
          options: [('', 'Ne rien reprendre'), for (final a in e.annees) (a['id'] as String, a['libelle'] as String)],
          changer: (v) => maj(() => copier = v == '' ? null : v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text("En faire l'année en cours"),
          value: activer,
          onChanged: (v) => maj(() => activer = v),
        ),
      ]),
      () async {
        final r = await Api.i.envoyer('POST', '/annees',
            corps: {'libelle': libelle.text.trim(), 'copierDepuisId': copier, 'activer': activer}, annee: false) as Map;
        cree = r['id'] as String;
      },
    );
    if (ok) {
      await e.chargerAnnees();
      if (cree != null) await e.choisirAnnee(cree!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = Etat.i;
    final sg = e.estSG;
    final c = context.c;
    return ListenableBuilder(
      listenable: e,
      builder: (context, _) => Scaffold(
        backgroundColor: Colors.transparent,
        floatingActionButton:
            sg ? FloatingActionButton.extended(onPressed: _nouvelle, icon: const Icon(Icons.add), label: const Text('Nouvelle année')) : null,
        body: Defilement(rafraichir: _rafraichir, enfants: [
          if (e.annee != null)
            Carte(
              titre: 'Séquences de ${e.annee!['libelle']}',
              sansMarge: true,
              enfant: Column(children: [
                for (final s in e.sequences)
                  ListTile(
                    title: Text('Séquence ${s['numero']} · trimestre ${s['trimestre']}'),
                    subtitle: Align(
                      alignment: Alignment.centerLeft,
                      child: s['saisieOuverte'] == true ? const EtatTexte('Saisie ouverte', ton: 'succes') : const EtatTexte('Saisie fermée'),
                    ),
                    trailing: sg
                        ? Switch(
                            value: s['saisieOuverte'] == true,
                            onChanged: (v) async {
                              final ok = await agir(
                                context,
                                () => Api.i.envoyer('PATCH', '/annees/sequences/${s['id']}', corps: {'saisieOuverte': v}, annee: false),
                                succes: 'Saisie de la séquence ${s['numero']} ${v ? 'ouverte' : 'fermée'}.',
                              );
                              if (ok) await e.chargerAnnees();
                            },
                          )
                        : null,
                  ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text('Une séquence fermée ne peut plus être modifiée par les professeurs.', style: TextStyle(color: c.encre2, fontSize: 13)),
                ),
              ]),
            ),
          Carte(
            titre: 'Années scolaires',
            sansMarge: true,
            enfant: Column(children: [
              for (final a in e.annees)
                ListTile(
                  title: Text(a['libelle'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${a['_count']['classes']} classes · ${a['_count']['inscriptions']} inscriptions'),
                  trailing: a['active'] == true
                      ? const EtatTexte('En cours', ton: 'succes')
                      : sg
                          ? TextButton(
                              onPressed: () async {
                                if (!await confirmer(context, 'Rendre active ?', "${a['libelle']} deviendra l'année en cours.")) return;
                                if (context.mounted &&
                                    await agir(context, () => Api.i.envoyer('POST', '/annees/${a['id']}/activer', annee: false), succes: 'Année activée.')) {
                                  await e.chargerAnnees();
                                }
                              },
                              child: const Text('Rendre active'),
                            )
                          : const EtatTexte('Archivée'),
                  onTap: () => e.choisirAnnee(a['id'] as String),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

// ---------------- Paramètres ----------------

class EcranParametres extends StatefulWidget {
  const EcranParametres({super.key});
  @override
  State<EcranParametres> createState() => _EcranParametresState();
}

const _champsEtablissement = [
  ('nomFr', 'Nom (français)'),
  ('nomEn', 'Nom (anglais)'),
  ('sigle', 'Sigle'),
  ('code', 'Code / immatriculation'),
  ('regionFr', 'Région (français)'),
  ('regionEn', 'Région (anglais)'),
  ('departementFr', 'Département (français)'),
  ('departementEn', 'Département (anglais)'),
  ('arrondissement', 'Arrondissement'),
  ('localite', 'Localité'),
  ('boitePostale', 'Boîte postale'),
  ('telephone', 'Téléphone'),
  ('prefixeMatricule', 'Préfixe des matricules'),
];

class _EcranParametresState extends State<EcranParametres> {
  final Map<String, TextEditingController> _etab = {};
  final Map<String, List<(TextEditingController, TextEditingController, TextEditingController)>> _baremes = {'GRADE': [], 'COTE': []};

  Future<bool> _charger() async {
    final e = await Api.i.get('/etablissement', annee: false) as Map? ?? {};
    for (final (k, _) in _champsEtablissement) {
      _etab[k] = TextEditingController(text: e[k] == null ? '' : '${e[k]}');
    }
    final b = (await Api.i.get('/baremes', annee: false) as List).cast<Map>()
      ..sort((x, y) => (y['min'] as num).compareTo(x['min'] as num));
    for (final t in ['GRADE', 'COTE']) {
      _baremes[t] = [
        for (final l in b.where((l) => l['type'] == t))
          (
            TextEditingController(text: l['libelle'] as String),
            TextEditingController(text: l['libelleLong'] as String? ?? ''),
            TextEditingController(text: '${l['min']}'.replaceAll('.', ',')),
          ),
      ];
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return Charge<bool>(
      charger: _charger,
      construire: (context, _, __) => Defilement(enfants: [
        Carte(
          titre: 'Établissement',
          action: TextButton(
            onPressed: () => agir(
              context,
              () => Api.i.envoyer('PUT', '/etablissement', corps: {for (final MapEntry(:key, :value) in _etab.entries) key: value.text.trim()}, annee: false),
              succes: 'Informations enregistrées.',
            ),
            child: const Text('Enregistrer'),
          ),
          enfant: Column(children: [
            for (final (k, l) in _champsEtablissement)
              Padding(padding: const EdgeInsets.only(bottom: 10), child: TextField(controller: _etab[k], decoration: InputDecoration(labelText: l))),
          ]),
        ),
        _bareme('GRADE', 'Grades par matière'),
        _bareme('COTE', 'Cotes de la moyenne générale'),
      ]),
    );
  }

  Widget _bareme(String type, String titre) {
    final lignes = _baremes[type]!;
    return StatefulBuilder(
      builder: (context, maj) => Carte(
        titre: titre,
        action: TextButton(
          onPressed: () => agir(
            context,
            () => Api.i.envoyer('PUT', '/baremes/$type',
                corps: [
                  for (final (l, ll, m) in lignes)
                    {'libelle': l.text.trim(), 'libelleLong': ll.text.trim(), 'min': double.tryParse(m.text.replaceAll(',', '.')) ?? -1}
                ],
                annee: false),
            succes: 'Barème enregistré.',
          ),
          child: const Text('Enregistrer'),
        ),
        enfant: Column(children: [
          Text("Chaque mention s'applique à partir de sa note minimale (incluse).", style: TextStyle(color: context.c.encre2, fontSize: 13)),
          const SizedBox(height: 10),
          for (final ligne in lignes)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                SizedBox(width: 72, child: TextField(controller: ligne.$1, decoration: const InputDecoration(labelText: 'Mention'))),
                const SizedBox(width: 8),
                if (type == 'COTE') ...[
                  Expanded(child: TextField(controller: ligne.$2, decoration: const InputDecoration(labelText: 'Signification'))),
                  const SizedBox(width: 8),
                ],
                SizedBox(
                  width: 80,
                  child: TextField(
                    controller: ligne.$3,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Dès'),
                  ),
                ),
                IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => maj(() => lignes.remove(ligne))),
              ]),
            ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Ajouter une mention'),
              onPressed: () => maj(() => lignes.add((TextEditingController(), TextEditingController(), TextEditingController()))),
            ),
          ),
        ]),
      ),
    );
  }
}
