import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'eleves.dart';
import 'saisie_eleves.dart';
import 'selection.dart';

// Cartes d'identité scolaires (RG-31) : la photo est obligatoire, les élèves sans photo sont écartés.

class EcranCartes extends StatefulWidget {
  const EcranCartes({super.key});
  @override
  State<EcranCartes> createState() => _EcranCartesState();
}

class _EcranCartesState extends State<EcranCartes> {
  final _selection = Selection();
  Map<String, dynamic>? _verification;
  String _verifiee = '';
  bool _envoi = false;

  // Vérifie les photos dès que la sélection change.
  Future<void> _verifier() async {
    final corps = _selection.corps();
    final cle = corps.toString();
    if (cle == _verifiee) return;
    _verifiee = cle;
    final vide = (corps.values.first as List).isEmpty;
    if (vide) {
      setState(() => _verification = null);
      return;
    }
    try {
      final r = await Api.i.envoyer('POST', '/documents/cartes/verification', corps: corps) as Map<String, dynamic>;
      if (mounted && _verifiee == cle) setState(() => _verification = r);
    } catch (e) {
      if (mounted) message(context, e is ErreurApi ? e.message : '$e', erreur: true);
    }
  }

  void _changer(void Function() f) {
    setState(f);
    _verifier();
  }

  @override
  Widget build(BuildContext context) {
    return Charge<List<Map<String, dynamic>>>(
      charger: chargerClasses,
      construire: (context, classes, _) {
        final v = _selection.nombre(classes) > 0 ? _verification : null;
        final sansPhoto = ((v?['sansPhoto'] as List?) ?? []).cast<Map>();
        final imprimables = v == null ? 0 : (v['total'] as int) - sansPhoto.length;
        final pages = (imprimables / 10).ceil();
        return Defilement(
          bas: FilledButton.icon(
            icon: _envoi
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.credit_card),
            label: Text(imprimables == 0 ? 'Choisissez des élèves avec photo' : 'Générer $imprimables carte(s) · $pages page(s) A4'),
            onPressed: imprimables == 0 || _envoi
                ? null
                : () async {
                    setState(() => _envoi = true);
                    await agir(context, () => Api.i.ouvrirDocument('/documents/cartes', methode: 'POST', corps: _selection.corps()));
                    if (mounted) setState(() => _envoi = false);
                  },
          ),
          enfants: [
            Text('Format carte bancaire (85,6 × 54 mm), dix cartes par page A4 avec traits de coupe.',
                style: TextStyle(color: context.c.encre2)),
            const SizedBox(height: 8),
            Carte(enfant: ChoixSelection(selection: _selection, classes: classes, changer: _changer)),
            if (sansPhoto.isNotEmpty)
              Carte(
                titre: '${sansPhoto.length} élève(s) sans photo',
                sansMarge: true,
                enfant: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                    child: Text("Leur carte ne sera pas imprimée. Ajoutez les photos, puis revenez ici.",
                        style: TextStyle(color: context.c.alerte, fontWeight: FontWeight.w600)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.photo_camera_outlined, size: 18),
                      label: const Text('Ajouter les photos manquantes'),
                      onPressed: () async {
                        final classe = classes.where((c) => c['nom'] == sansPhoto.first['classe']).firstOrNull;
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => EcranPhotosClasse(classes: classes, classeParDefaut: classe?['id'] as String?, sansPhotoParDefaut: true),
                          ),
                        );
                        _verifiee = '';
                        _verifier();
                      },
                    ),
                  ),
                  for (final e in sansPhoto)
                    ListTile(
                      dense: true,
                      title: Text('${e['nom']} ${e['prenoms']}'),
                      subtitle: Text('${e['classe']} · ${e['matricule']}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => FicheEleve(id: e['eleveId'] as String)));
                        _verifiee = '';
                        _verifier();
                      },
                    ),
                ]),
              )
            else if (v != null && (v['total'] as int) > 0)
              const Padding(padding: EdgeInsets.only(top: 4), child: EtatTexte('Tous les élèves choisis ont une photo.', ton: 'succes')),
          ],
        );
      },
    );
  }
}
