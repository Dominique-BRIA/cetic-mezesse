import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// Choix des élèves pour un document (bulletins, cartes) : des classes entières ou quelques élèves.
class Selection {
  bool parEleves = false;
  final Set<String> classes = {};
  String? classeEleves;
  final Set<String> eleves = {};

  int nombre(List<Map<String, dynamic>> toutes) => parEleves
      ? eleves.length
      : toutes.where((c) => classes.contains(c['id'])).fold<int>(0, (s, c) => s + (c['_count']['inscriptions'] as int));

  /// Corps envoyé à l'API : { classeIds } ou { inscriptionIds }.
  Map<String, Object> corps() => parEleves ? {'inscriptionIds': eleves.toList()..sort()} : {'classeIds': classes.toList()..sort()};
}

class ChoixSelection extends StatelessWidget {
  const ChoixSelection({super.key, required this.selection, required this.classes, required this.changer});
  final Selection selection;
  final List<Map<String, dynamic>> classes;

  /// Applique une modification de la sélection et redessine l'écran.
  final void Function(void Function()) changer;

  @override
  Widget build(BuildContext context) {
    final s = selection;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SegmentedButton<bool>(
        segments: const [ButtonSegment(value: false, label: Text('Classes entières')), ButtonSegment(value: true, label: Text('Élèves choisis'))],
        selected: {s.parEleves},
        onSelectionChanged: (v) => changer(() => s.parEleves = v.first),
      ),
      const SizedBox(height: 6),
      if (!s.parEleves) ...[
        for (final c in classes)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: s.classes.contains(c['id']),
            title: Text(c['nom'] as String),
            secondary: Text('${c['_count']['inscriptions']}', style: TextStyle(color: context.c.encre3)),
            onChanged: (v) => changer(() => v == true ? s.classes.add(c['id'] as String) : s.classes.remove(c['id'])),
          ),
        if (classes.length > 1)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => changer(() => s.classes.length == classes.length ? s.classes.clear() : s.classes.addAll(classes.map((c) => c['id'] as String))),
              child: Text(s.classes.length == classes.length ? 'Aucune' : "Tout l'établissement"),
            ),
          ),
      ] else ...[
        const SizedBox(height: 6),
        Choix<String>(
          libelle: 'Classe',
          valeur: s.classeEleves,
          options: [for (final c in classes) (c['id'] as String, c['nom'] as String)],
          changer: (v) => changer(() {
            s.classeEleves = v;
            s.eleves.clear();
          }),
        ),
        if (s.classeEleves != null)
          Charge<List>(
            key: ValueKey(s.classeEleves),
            charger: () async => await Api.i.get('/eleves?classeId=${s.classeEleves}') as List,
            construire: (context, eleves, _) => Column(children: [
              for (final i in eleves.cast<Map>())
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: s.eleves.contains(i['id']),
                  title: Text('${i['eleve']['nom']} ${i['eleve']['prenoms']}'),
                  onChanged: (v) => changer(() => v == true ? s.eleves.add(i['id'] as String) : s.eleves.remove(i['id'])),
                ),
            ]),
          ),
      ],
    ]);
  }
}
