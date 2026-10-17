// Journal de diagnostic affiché par-dessus l'application : étapes du démarrage, appels au
// serveur et erreurs. Activé par défaut le temps de régler le démarrage sur téléphone ;
// à couper au build avec --dart-define=JOURNAL=false.
import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';

const journalActif = bool.fromEnvironment('JOURNAL', defaultValue: true);

final ValueNotifier<List<String>> journal = ValueNotifier(const []);
final _debut = DateTime.now();

/// Ajoute une ligne horodatée (en millisecondes depuis le lancement).
void noter(String ligne) {
  final ms = DateTime.now().difference(_debut).inMilliseconds;
  final texte = '${(ms / 1000).toStringAsFixed(2).padLeft(6)}s  $ligne';
  debugPrint('[journal] $texte');
  if (!journalActif) return;
  // Hors de la phase de construction : un appel pendant un build ne doit rien casser.
  scheduleMicrotask(() {
    final lignes = [...journal.value, texte];
    journal.value = lignes.length > 80 ? lignes.sublist(lignes.length - 80) : lignes;
  });
}

class PanneauJournal extends StatefulWidget {
  const PanneauJournal({super.key});
  @override
  State<PanneauJournal> createState() => _PanneauJournalState();
}

class _PanneauJournalState extends State<PanneauJournal> {
  bool _reduit = false;

  @override
  Widget build(BuildContext context) {
    final bas = MediaQuery.of(context).padding.bottom;
    return Positioned(
      left: 6,
      right: 6,
      bottom: 6 + bas,
      child: GestureDetector(
        onTap: () => setState(() => _reduit = !_reduit),
        child: Material(
          color: const Color(0xE6000000),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
            child: ValueListenableBuilder<List<String>>(
              valueListenable: journal,
              builder: (context, lignes, _) {
                final visibles = _reduit ? const <String>[] : lignes.skip(lignes.length > 22 ? lignes.length - 22 : 0).toList();
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                  Text(
                    'JOURNAL · version $versionApp · ${lignes.length} lignes · toucher pour ${_reduit ? 'ouvrir' : 'réduire'}',
                    style: const TextStyle(color: Color(0xFFFCD116), fontSize: 10.5, fontWeight: FontWeight.w700),
                  ),
                  for (final l in visibles)
                    Text(
                      l,
                      style: TextStyle(
                        color: l.contains('ERREUR') ? const Color(0xFFFF8A80) : const Color(0xFFE0E0E0),
                        fontSize: 10,
                        fontFamily: 'monospace',
                        height: 1.25,
                      ),
                    ),
                ]);
              },
            ),
          ),
        ),
      ),
    );
  }
}
