// Démarrage de l'application : l'écran d'ouverture ne doit jamais rester bloqué.
// Les requêtes HTTP échouent dans les tests, comme un serveur injoignable.
import 'dart:convert';

import 'package:cetic_mezesse/ecrans/connexion.dart';
import 'package:cetic_mezesse/ecrans/coquille.dart';
import 'package:cetic_mezesse/etat.dart';
import 'package:cetic_mezesse/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const profil = {
  'id': 'p1',
  'nom': 'MESSI',
  'prenom': 'Hélène',
  'telephone': '691000010',
  'email': null,
  'role': 'PROFESSEUR',
  'actif': true,
  'doitChangerMotDePasse': false,
  'discipline': 'Législation',
};

Future<void> demarrer(WidgetTester t, Map<String, Object> prefs) async {
  SharedPreferences.setMockInitialValues(prefs);
  Etat.i
    ..utilisateur = null
    ..annees = []
    ..demarrage = true;
  await t.runAsync(() => Etat.i.demarrer().timeout(const Duration(seconds: 5)));
  await t.pumpWidget(const Application());
  await t.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('sans session : écran de connexion tout de suite', (t) async {
    await demarrer(t, {});
    expect(Etat.i.demarrage, isFalse);
    expect(find.byType(EcranConnexion), findsOneWidget);
  });

  testWidgets('session avec profil gardé : accueil sans attendre le serveur', (t) async {
    await demarrer(t, {'jeton': 'j', 'profil': jsonEncode(profil)});
    expect(Etat.i.demarrage, isFalse);
    expect(Etat.i.utilisateur?['prenom'], 'Hélène');
    expect(find.byType(Coquille), findsOneWidget);
  });

  testWidgets('session sans profil gardé : écran de connexion', (t) async {
    await demarrer(t, {'jeton': 'j'});
    expect(Etat.i.demarrage, isFalse);
    expect(find.byType(EcranConnexion), findsOneWidget);
  });

  testWidgets('file d’attente illisible : le démarrage aboutit quand même', (t) async {
    await demarrer(t, {'file-attente': '{pas du json'});
    expect(Etat.i.demarrage, isFalse);
    expect(find.byType(EcranConnexion), findsOneWidget);
  });

  testWidgets('pas de cercle de chargement après le démarrage', (t) async {
    await demarrer(t, {'jeton': 'j', 'profil': jsonEncode(profil)});
    expect(find.byWidgetPredicate((w) => w is Scaffold && w.appBar == null && w.body is Center), findsNothing);
  });
}
