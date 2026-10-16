import 'package:flutter/material.dart';

import '../api.dart';
import '../etat.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'graphiques.dart';
import 'prof.dart';

/// Sélecteurs en tête d'écran, sur une carte.
Widget _filtres(List<Widget> champs) => Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            for (var i = 0; i < champs.length; i++) ...[if (i > 0) const SizedBox(height: 10), champs[i]],
          ]),
        ),
      ),
    );

// ---------------- Notes ----------------

class EcranNotes extends StatefulWidget {
  const EcranNotes({super.key});
  @override
  State<EcranNotes> createState() => _EcranNotesState();
}

class _EcranNotesState extends State<EcranNotes> {
  String? _classe;
  String _periode = 'S1';
  bool _manquantes = false;

  @override
  Widget build(BuildContext context) {
    return Charge<List<Map<String, dynamic>>>(
      charger: chargerClasses,
      construire: (context, classes, _) {
        if (classes.isEmpty) return const Defilement(enfants: [Carte(enfant: Vide('Aucune classe'))]);
        final classeId = _classe ?? classes.first['id'] as String;
        final estSequence = _periode.startsWith('S');
        return Column(children: [
          _filtres([
            Choix<String>(
              libelle: 'Classe',
              valeur: classeId,
              options: [for (final c in classes) (c['id'] as String, c['nom'] as String)],
              changer: (v) => setState(() => _classe = v),
            ),
            ChoixPeriode(
              valeur: _periode,
              changer: (v) => setState(() {
                _periode = v;
                if (!v.startsWith('S')) _manquantes = false;
              }),
            ),
            Row(children: [
              Expanded(
                child: SegmentedButton<bool>(
                  segments: [
                    const ButtonSegment(value: false, label: Text('Relevé')),
                    ButtonSegment(value: true, label: const Text('Manquantes'), enabled: estSequence),
                  ],
                  selected: {_manquantes},
                  onSelectionChanged: (s) => setState(() => _manquantes = s.first),
                ),
              ),
              IconButton(
                tooltip: 'Exporter en Excel',
                icon: const Icon(Icons.table_chart_outlined),
                onPressed: () => agir(context, () => Api.i.ouvrirDocument('/documents/releve?classeId=$classeId&periode=$_periode')),
              ),
            ]),
          ]),
          Expanded(
            child: _manquantes
                ? Charge<Map>(
                    key: ValueKey('m|$classeId|$_periode'),
                    charger: () async {
                      final seq = Etat.i.sequences.firstWhere((s) => 'S${s['numero']}' == _periode);
                      return await Api.i.get('/notes/manquantes?sequenceId=${seq['id']}&classeId=$classeId') as Map;
                    },
                    construire: (context, d, recharger) => ListeManquantes(d, rafraichir: recharger, avecProf: true),
                  )
                : Charge<Map>(
                    key: ValueKey('r|$classeId|$_periode'),
                    charger: () async => await Api.i.get('/notes/classe?classeId=$classeId&periode=$_periode') as Map,
                    construire: (context, r, recharger) => _Releve(r, recharger),
                  ),
          ),
        ]);
      },
    );
  }
}

class _Releve extends StatelessWidget {
  const _Releve(this.r, this.recharger);
  final Map r;
  final Future<void> Function() recharger;

  @override
  Widget build(BuildContext context) {
    final matieres = (r['matieres'] as List).cast<Map>();
    final eleves = (r['eleves'] as List).cast<Map>()
      ..sort((a, b) => ((a['rang']?['rang'] as int?) ?? 999).compareTo((b['rang']?['rang'] as int?) ?? 999));
    final profil = r['profil'] as Map;
    return Defilement(rafraichir: recharger, enfants: [
      GrilleIndicateurs(enfants: [
        Indicateur(libelle: 'Moyenne de classe', valeur: note(profil['moyenneGenerale'] as num?), accent: true),
        Indicateur(libelle: 'Réussite', valeur: pourcent(profil['tauxReussite'] as num?), detail: '${profil['nombreMoyennes']} moyennes'),
      ]),
      if (eleves.isEmpty) const Carte(enfant: Vide('Aucun élève')),
      Carte(
        titre: '${eleves.length} élèves · touchez un élève pour ses notes',
        sansMarge: true,
        enfant: Column(children: [
          for (final e in eleves)
            ExpansionTile(
              shape: const Border(),
              leading: SizedBox(width: 44, child: Text(rang(e['rang'] as Map?), style: TextStyle(color: context.c.encre2))),
              title: Text('${e['nom']} ${e['prenoms']}', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14.5)),
              trailing: Text(note(e['moyenne'] as num?),
                  style: TextStyle(fontWeight: FontWeight.w700, color: couleurNote(context, e['moyenne'] as num?))),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              children: [
                for (var i = 0; i < matieres.length; i++)
                  if (matieres[i]['evaluee'] == true)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(children: [
                        Expanded(child: Text('${matieres[i]['nom']} (${matieres[i]['coefficient']})', style: TextStyle(color: context.c.encre2, fontSize: 13))),
                        Text(note((e['notes'] as List)[i] as num?),
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: couleurNote(context, (e['notes'] as List)[i] as num?))),
                      ]),
                    ),
              ],
            ),
        ]),
      ),
      Carte(
        titre: 'Moyennes de classe par matière',
        enfant: BarresMoyennes([for (final m in matieres) (m['nom'] as String, m['evaluee'] == true ? m['moyenne'] as num? : null)]),
      ),
    ]);
  }
}

// ---------------- Bulletins et listes ----------------

class EcranDocuments extends StatefulWidget {
  const EcranDocuments({super.key});
  @override
  State<EcranDocuments> createState() => _EcranDocumentsState();
}

class _EcranDocumentsState extends State<EcranDocuments> {
  String _periode = 'S1';
  bool _parEleves = false;
  final Set<String> _classes = {};
  String? _classeEleves;
  final Set<String> _eleves = {};
  bool _envoi = false;

  @override
  Widget build(BuildContext context) {
    return Charge<List<Map<String, dynamic>>>(
      charger: chargerClasses,
      construire: (context, classes, _) {
        final nombre = _parEleves
            ? _eleves.length
            : classes.where((c) => _classes.contains(c['id'])).fold<int>(0, (s, c) => s + (c['_count']['inscriptions'] as int));
        return Defilement(
          bas: FilledButton.icon(
            icon: _envoi
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.picture_as_pdf_outlined),
            label: Text(nombre == 0 ? 'Choisissez des classes ou des élèves' : 'Générer $nombre bulletin(s)'),
            onPressed: nombre == 0 || _envoi
                ? null
                : () async {
                    setState(() => _envoi = true);
                    await agir(
                      context,
                      () => Api.i.ouvrirDocument('/documents/bulletins', methode: 'POST', corps: {
                        'periode': _periode,
                        if (_parEleves) 'inscriptionIds': _eleves.toList() else 'classeIds': _classes.toList(),
                      }),
                    );
                    if (mounted) setState(() => _envoi = false);
                  },
          ),
          enfants: [
            Carte(
              titre: 'Bulletins de notes',
              enfant: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                ChoixPeriode(valeur: _periode, changer: (v) => setState(() => _periode = v)),
                const SizedBox(height: 10),
                SegmentedButton<bool>(
                  segments: const [ButtonSegment(value: false, label: Text('Classes entières')), ButtonSegment(value: true, label: Text('Élèves choisis'))],
                  selected: {_parEleves},
                  onSelectionChanged: (s) => setState(() => _parEleves = s.first),
                ),
                const SizedBox(height: 6),
                if (!_parEleves) ...[
                  for (final c in classes)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _classes.contains(c['id']),
                      title: Text(c['nom'] as String),
                      secondary: Text('${c['_count']['inscriptions']}', style: TextStyle(color: context.c.encre3)),
                      onChanged: (v) => setState(() => v == true ? _classes.add(c['id'] as String) : _classes.remove(c['id'])),
                    ),
                  if (classes.length > 1)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => setState(() =>
                            _classes.length == classes.length ? _classes.clear() : _classes.addAll(classes.map((c) => c['id'] as String))),
                        child: Text(_classes.length == classes.length ? 'Aucune' : "Tout l'établissement"),
                      ),
                    ),
                ] else ...[
                  const SizedBox(height: 6),
                  Choix<String>(
                    libelle: 'Classe',
                    valeur: _classeEleves,
                    options: [for (final c in classes) (c['id'] as String, c['nom'] as String)],
                    changer: (v) => setState(() {
                      _classeEleves = v;
                      _eleves.clear();
                    }),
                  ),
                  if (_classeEleves != null)
                    Charge<List>(
                      key: ValueKey(_classeEleves),
                      charger: () async => await Api.i.get('/eleves?classeId=$_classeEleves') as List,
                      construire: (context, eleves, _) => Column(children: [
                        for (final i in eleves.cast<Map>())
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            value: _eleves.contains(i['id']),
                            title: Text('${i['eleve']['nom']} ${i['eleve']['prenoms']}'),
                            onChanged: (v) => setState(() => v == true ? _eleves.add(i['id'] as String) : _eleves.remove(i['id'])),
                          ),
                      ]),
                    ),
                ],
              ]),
            ),
            Carte(
              titre: 'Listes de classe',
              sansMarge: true,
              enfant: Column(children: [
                for (final c in classes)
                  ListTile(
                    title: Text(c['nom'] as String),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(
                        tooltip: 'PDF',
                        icon: const Icon(Icons.picture_as_pdf_outlined),
                        onPressed: () => agir(context, () => Api.i.ouvrirDocument('/documents/liste?classeId=${c['id']}&format=pdf')),
                      ),
                      IconButton(
                        tooltip: 'Excel',
                        icon: const Icon(Icons.table_chart_outlined),
                        onPressed: () => agir(context, () => Api.i.ouvrirDocument('/documents/liste?classeId=${c['id']}&format=xlsx')),
                      ),
                    ]),
                  ),
              ]),
            ),
          ],
        );
      },
    );
  }
}

// ---------------- Statistiques ----------------

class EcranStatistiques extends StatefulWidget {
  const EcranStatistiques({super.key});
  @override
  State<EcranStatistiques> createState() => _EcranStatistiquesState();
}

class _EcranStatistiquesState extends State<EcranStatistiques> {
  String _vue = 'etablissement';
  String _periode = 'S1';
  String? _classe;
  String? _matiere;

  @override
  Widget build(BuildContext context) {
    return Charge<List<Map<String, dynamic>>>(
      charger: chargerClasses,
      construire: (context, classes, _) {
        final classeId = _classe ?? (classes.isEmpty ? null : classes.first['id'] as String);
        return Column(children: [
          _filtres([
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'etablissement', label: Text('Établ.')),
                ButtonSegment(value: 'classe', label: Text('Classe')),
                ButtonSegment(value: 'matiere', label: Text('Matière')),
              ],
              selected: {_vue},
              onSelectionChanged: (s) => setState(() => _vue = s.first),
            ),
            ChoixPeriode(valeur: _periode, changer: (v) => setState(() => _periode = v)),
            if (_vue != 'etablissement' && classeId != null)
              Choix<String>(
                libelle: 'Classe',
                valeur: classeId,
                options: [for (final c in classes) (c['id'] as String, c['nom'] as String)],
                changer: (v) => setState(() {
                  _classe = v;
                  _matiere = null;
                }),
              ),
            if (_vue == 'matiere' && classeId != null)
              Charge<List>(
                key: ValueKey('mat|$classeId'),
                charger: () async => await Api.i.get('/matieres?classeId=$classeId') as List,
                construire: (context, matieres, _) => Choix<String>(
                  libelle: 'Matière',
                  valeur: _matiere,
                  options: [for (final m in matieres.cast<Map>()) (m['id'] as String, m['nom'] as String)],
                  changer: (v) => setState(() => _matiere = v),
                ),
              ),
          ]),
          Expanded(
            child: switch (_vue) {
              'etablissement' => _StatsEtablissement(key: ValueKey('e|$_periode'), periode: _periode),
              'classe' when classeId != null => _StatsClasse(key: ValueKey('c|$classeId|$_periode'), classeId: classeId, periode: _periode),
              'matiere' when _matiere != null => StatsMatiere(key: ValueKey('m|$_matiere|$_periode'), matiereId: _matiere!, periode: _periode),
              _ => const Defilement(enfants: [Carte(enfant: Vide('Choisissez une matière'))]),
            },
          ),
        ]);
      },
    );
  }
}

class _StatsEtablissement extends StatelessWidget {
  const _StatsEtablissement({super.key, required this.periode});
  final String periode;

  @override
  Widget build(BuildContext context) {
    return Charge<Map>(
      charger: () async => await Api.i.get('/statistiques/etablissement?periode=$periode') as Map,
      construire: (context, s, recharger) {
        final r = s['resume'] as Map;
        if (r['effectif'] == 0) return const Defilement(enfants: [Carte(enfant: Vide('Pas encore de notes sur cette période'))]);
        String eleves(List l) => l.isEmpty ? '—' : l.map((e) => '${e['nom']} ${e['prenoms']} (${e['classe']['nom']}, ${note(e['moyenne'] as num?)})').join('\n');
        String classe(Map? c) => c == null ? '—' : '${c['nom']} (${note(c['moyenneGenerale'] as num?)})';
        return Defilement(rafraichir: recharger, enfants: [
          GrilleIndicateurs(enfants: [
            Indicateur(libelle: 'Moyenne générale', valeur: note(r['moyenne'] as num?), accent: true, detail: '${r['effectif']} élèves'),
            Indicateur(libelle: 'Réussite', valeur: pourcent(r['tauxReussite'] as num?), detail: '${r['reussis']} à 10 ou plus'),
            Indicateur(libelle: 'Min – max', valeur: '${note(r['min'] as num?)} – ${note(r['max'] as num?)}'),
            Indicateur(libelle: 'Écart-type', valeur: note(r['ecartType'] as num?)),
          ]),
          Carte(
            titre: 'Premiers et derniers',
            enfant: Column(children: [
              LigneInfo('Premier', eleves(s['premier'] as List), gras: true),
              LigneInfo('Dernier', eleves(s['dernier'] as List)),
              LigneInfo('Première classe', classe(s['premiereClasse'] as Map?), gras: true),
              LigneInfo('Dernière classe', classe(s['derniereClasse'] as Map?)),
            ]),
          ),
          Carte(titre: 'Répartition des moyennes', enfant: Repartition(s['repartition'] as List)),
          Carte(titre: 'Filles et garçons', enfant: ParSexe(s['parSexe'] as List)),
          Carte(
            titre: 'Classes',
            sansMarge: true,
            enfant: Column(children: [
              for (final c in (s['classes'] as List).cast<Map>())
                ListTile(
                  leading: SizedBox(width: 36, child: Text(rang(c['rang'] as Map?))),
                  title: Text(c['nom'] as String),
                  subtitle: Text('${c['effectif']} élèves · réussite ${pourcent(c['tauxReussite'] as num?)}'),
                  trailing: Text(note(c['moyenneGenerale'] as num?),
                      style: TextStyle(fontWeight: FontWeight.w700, color: couleurNote(context, c['moyenneGenerale'] as num?))),
                ),
            ]),
          ),
          Carte(
            titre: 'Moyenne par matière',
            enfant: BarresMoyennes([for (final m in (s['matieres'] as List).cast<Map>()) (m['nom'] as String, m['moyenne'] as num?)]),
          ),
        ]);
      },
    );
  }
}

class _StatsClasse extends StatelessWidget {
  const _StatsClasse({super.key, required this.classeId, required this.periode});
  final String classeId;
  final String periode;

  @override
  Widget build(BuildContext context) {
    return Charge<Map>(
      charger: () async => await Api.i.get('/statistiques/classe?classeId=$classeId&periode=$periode') as Map,
      construire: (context, s, recharger) {
        final p = s['profil'] as Map;
        if (p['moyenneGenerale'] == null) return const Defilement(enfants: [Carte(enfant: Vide('Pas encore de notes sur cette période'))]);
        return Defilement(rafraichir: recharger, enfants: [
          GrilleIndicateurs(enfants: [
            Indicateur(libelle: 'Moyenne', valeur: note(p['moyenneGenerale'] as num?), accent: true, detail: '${p['effectif']} élèves'),
            Indicateur(libelle: 'Réussite', valeur: pourcent(p['tauxReussite'] as num?), detail: '${p['nombreMoyennes']} moyennes'),
            Indicateur(libelle: 'Min – max', valeur: '${note(p['min'] as num?)} – ${note(p['max'] as num?)}'),
            Indicateur(libelle: 'Écart-type', valeur: note(p['ecartType'] as num?)),
          ]),
          Carte(titre: 'Évolution de la moyenne', enfant: Evolution(s['evolution'] as List)),
          Carte(titre: 'Répartition des moyennes', enfant: Repartition(s['repartition'] as List)),
          Carte(titre: 'Filles et garçons', enfant: ParSexe(s['parSexe'] as List)),
          Carte(
            titre: 'Moyenne par matière',
            enfant: BarresMoyennes([
              for (final m in (s['matieres'] as List).cast<Map>()) (m['nom'] as String, m['evaluee'] == true ? m['moyenne'] as num? : null)
            ]),
          ),
          Carte(
            titre: 'Classement de la classe',
            sansMarge: true,
            enfant: Column(children: [
              for (final e in (s['classement'] as List).cast<Map>())
                ListTile(
                  leading: SizedBox(width: 44, child: Text(rang(e['rang'] as Map?))),
                  title: Text('${e['nom']} ${e['prenoms']}'),
                  trailing: Text(note(e['moyenne'] as num?), style: TextStyle(fontWeight: FontWeight.w700, color: couleurNote(context, e['moyenne'] as num?))),
                ),
            ]),
          ),
        ]);
      },
    );
  }
}

// ---------------- Classement général ----------------

class EcranClassement extends StatefulWidget {
  const EcranClassement({super.key});
  @override
  State<EcranClassement> createState() => _EcranClassementState();
}

class _EcranClassementState extends State<EcranClassement> {
  String _periode = 'S1';
  String _classe = '';

  @override
  Widget build(BuildContext context) {
    return Charge<Map>(
      key: ValueKey(_periode),
      charger: () async => await Api.i.get('/statistiques/etablissement?periode=$_periode') as Map,
      construire: (context, s, recharger) {
        final tous = (s['classement'] as List).cast<Map>();
        final dernierRang = tous.isEmpty ? null : tous.last['rang']['rang'];
        final lignes = tous.where((e) => _classe.isEmpty || e['classe']['id'] == _classe).toList();
        final c = context.c;
        return Column(children: [
          _filtres([
            ChoixPeriode(valeur: _periode, changer: (v) => setState(() => _periode = v)),
            Choix<String>(
              libelle: 'Classe',
              valeur: _classe,
              options: [('', 'Toutes'), for (final k in (s['classes'] as List).cast<Map>()) (k['id'] as String, k['nom'] as String)],
              changer: (v) => setState(() => _classe = v ?? ''),
            ),
          ]),
          Expanded(
            child: Defilement(rafraichir: recharger, enfants: [
              Carte(
                titre: '${libellePeriode(_periode)} · ${tous.length} élèves classés',
                sansMarge: true,
                enfant: lignes.isEmpty
                    ? const Vide('Aucun élève classé')
                    : Column(children: [
                        for (final e in lignes)
                          Container(
                            color: e['rang']['rang'] == 1
                                ? c.succes.withValues(alpha: 0.07)
                                : (e['rang']['rang'] == dernierRang && tous.length > 1 ? c.danger.withValues(alpha: 0.07) : null),
                            child: ListTile(
                              leading: SizedBox(width: 48, child: Text(rang(e['rang'] as Map?), style: const TextStyle(fontWeight: FontWeight.w700))),
                              title: Text('${e['nom']} ${e['prenoms']}'),
                              subtitle: Text('${e['classe']['nom']} · ${rang(e['rangClasse'] as Map?)} de la classe'),
                              trailing: Text(note(e['moyenne'] as num?),
                                  style: TextStyle(fontWeight: FontWeight.w700, color: couleurNote(context, e['moyenne'] as num?))),
                            ),
                          ),
                      ]),
              ),
            ]),
          ),
        ]);
      },
    );
  }
}
