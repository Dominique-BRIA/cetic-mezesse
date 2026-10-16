// État de l'application : utilisateur connecté, années scolaires, thème.
import 'package:flutter/material.dart';

import 'api.dart';
import 'file_attente.dart';

class Etat extends ChangeNotifier {
  Etat._();
  static final Etat i = Etat._();

  Map<String, dynamic>? utilisateur;
  List<Map<String, dynamic>> annees = [];
  ThemeMode theme = ThemeMode.system;
  bool demarrage = true;

  String get role => utilisateur?['role'] as String? ?? '';
  bool a(List<String> roles) => roles.contains(role);
  bool get estProf => role == 'PROFESSEUR';
  bool get estSG => role == 'SURVEILLANT_GENERAL';
  bool get estProviseur => role == 'PROVISEUR';

  Map<String, dynamic>? get annee {
    for (final a in annees) {
      if (a['id'] == Api.i.anneeId) return a;
    }
    for (final a in annees) {
      if (a['active'] == true) return a;
    }
    return annees.isEmpty ? null : annees.first;
  }

  List<Map<String, dynamic>> get sequences =>
      ((annee?['sequences'] as List?) ?? []).cast<Map<String, dynamic>>();

  Map<String, dynamic>? get sequenceOuverte {
    for (final s in sequences) {
      if (s['saisieOuverte'] == true) return s;
    }
    return null;
  }

  Future<void> demarrer() async {
    await Api.i.initialiser();
    FileAttente.i.charger();
    theme = switch (Api.i.prefs.getString('theme')) {
      'dark' => ThemeMode.dark,
      'light' => ThemeMode.light,
      _ => ThemeMode.system,
    };
    Api.i.surSessionExpiree = deconnecter;
    Api.i.surRetourReseau = () => FileAttente.i.synchroniser();
    if (Api.i.jeton != null) {
      try {
        utilisateur = (await Api.i.get('/auth/moi', annee: false) as Map).cast<String, dynamic>();
        await chargerAnnees();
        FileAttente.i.synchroniser();
      } on ErreurApi catch (e) {
        if (!e.horsLigne) await deconnecter();
      }
    }
    demarrage = false;
    notifyListeners();
  }

  Future<void> chargerAnnees() async {
    annees = (await Api.i.get('/annees', annee: false) as List).cast<Map<String, dynamic>>();
    final choisie = annee;
    if (choisie != null && choisie['id'] != Api.i.anneeId) {
      Api.i.anneeId = choisie['id'] as String;
      await Api.i.prefs.setString('annee', Api.i.anneeId!);
    }
    notifyListeners();
  }

  Future<void> connecter(String jeton, Map<String, dynamic> u) async {
    Api.i.jeton = jeton;
    await Api.i.prefs.setString('jeton', jeton);
    utilisateur = u;
    await chargerAnnees();
    notifyListeners();
  }

  Future<void> rafraichirProfil() async {
    utilisateur = (await Api.i.get('/auth/moi', annee: false) as Map).cast<String, dynamic>();
    notifyListeners();
  }

  Future<void> deconnecter() async {
    Api.i.jeton = null;
    await Api.i.prefs.remove('jeton');
    // La copie locale appartient au compte qui se déconnecte.
    for (final k in Api.i.prefs.getKeys().where((k) => k.startsWith('cache:')).toList()) {
      await Api.i.prefs.remove(k);
    }
    utilisateur = null;
    notifyListeners();
  }

  Future<void> choisirAnnee(String id) async {
    Api.i.anneeId = id;
    await Api.i.prefs.setString('annee', id);
    notifyListeners();
  }

  Future<void> basculerTheme(Brightness actuelle) async {
    theme = actuelle == Brightness.dark ? ThemeMode.light : ThemeMode.dark;
    await Api.i.prefs.setString('theme', theme == ThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }
}
