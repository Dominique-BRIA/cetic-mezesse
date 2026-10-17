// Notes saisies sans réseau : gardées sur le téléphone puis envoyées dès que le serveur répond.
import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'api.dart';

class Envoi {
  Envoi({
    required this.matiereId,
    required this.sequenceId,
    required this.libelle,
    required this.notes,
    this.competence,
    this.erreur,
  });

  final String matiereId;
  final String sequenceId;
  final String libelle;
  final Map<String, double?> notes; // inscriptionId → note (null = effacer)
  String? competence;
  String? erreur;

  String get cle => '$matiereId|$sequenceId';

  Map<String, dynamic> versJson() => {
        'matiereId': matiereId,
        'sequenceId': sequenceId,
        'libelle': libelle,
        'notes': notes,
        'competence': competence,
        'erreur': erreur,
      };

  factory Envoi.depuisJson(Map<String, dynamic> j) => Envoi(
        matiereId: j['matiereId'] as String,
        sequenceId: j['sequenceId'] as String,
        libelle: j['libelle'] as String,
        notes: (j['notes'] as Map).map((k, v) => MapEntry(k as String, (v as num?)?.toDouble())),
        competence: j['competence'] as String?,
        erreur: j['erreur'] as String?,
      );
}

class FileAttente extends ChangeNotifier {
  FileAttente._();
  static final FileAttente i = FileAttente._();

  final List<Envoi> _envois = [];
  bool _enCours = false;

  List<Envoi> get envois => List.unmodifiable(_envois);
  int get nombreNotes => _envois.fold(0, (s, e) => s + e.notes.length);

  void charger() {
    final brut = Api.i.prefs.getString('file-attente');
    if (brut == null) return;
    try {
      _envois
        ..clear()
        ..addAll((jsonDecode(brut) as List).map((e) => Envoi.depuisJson(e as Map<String, dynamic>)));
    } catch (e) {
      // Copie abîmée : gardée à part pour ne rien perdre, puis la file repart vide.
      debugPrint('File d’attente illisible : $e');
      _envois.clear();
      Api.i.prefs.setString('file-attente-illisible', brut);
      Api.i.prefs.remove('file-attente');
    }
    notifyListeners();
  }

  Future<void> _sauver() async {
    await Api.i.prefs.setString('file-attente', jsonEncode(_envois.map((e) => e.versJson()).toList()));
    notifyListeners();
  }

  Envoi? pour(String matiereId, String sequenceId) {
    for (final e in _envois) {
      if (e.cle == '$matiereId|$sequenceId') return e;
    }
    return null;
  }

  /// Ajoute des notes en attente ; les nouvelles valeurs remplacent les anciennes pour le même élève.
  Future<void> ajouter(Envoi nouveau) async {
    final existant = pour(nouveau.matiereId, nouveau.sequenceId);
    if (existant == null) {
      _envois.add(nouveau);
    } else {
      existant.notes.addAll(nouveau.notes);
      existant.competence = nouveau.competence ?? existant.competence;
      existant.erreur = null;
    }
    await _sauver();
  }

  Future<void> retirer(Envoi e) async {
    _envois.remove(e);
    await _sauver();
  }

  /// Envoie tout ce qui attend. Retourne le nombre de feuilles envoyées.
  Future<int> synchroniser() async {
    if (_enCours || _envois.isEmpty || Api.i.jeton == null) return 0;
    _enCours = true;
    var envoyes = 0;
    try {
      for (final e in List<Envoi>.from(_envois)) {
        try {
          await Api.i.put('/notes/feuille', {
            'matiereId': e.matiereId,
            'sequenceId': e.sequenceId,
            if (e.competence != null) 'competence': e.competence,
            'notes': e.notes.entries.map((n) => {'inscriptionId': n.key, 'valeur': n.value}).toList(),
          });
          _envois.remove(e);
          envoyes++;
        } on ErreurApi catch (err) {
          if (err.horsLigne) break; // toujours pas de réseau : on réessaiera
          e.erreur = err.message; // refus du serveur (séquence fermée…) : on garde et on signale
        }
      }
    } finally {
      _enCours = false;
      await _sauver();
    }
    return envoyes;
  }
}
