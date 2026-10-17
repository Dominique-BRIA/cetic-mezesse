import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'ecrans/coquille.dart';
import 'ecrans/connexion.dart';
import 'etat.dart';
import 'file_attente.dart';
import 'motif.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  Etat.i.demarrer();
  // Nouvelle tentative d'envoi des notes en attente toutes les minutes.
  Timer.periodic(const Duration(minutes: 1), (_) {
    if (FileAttente.i.envois.isNotEmpty) FileAttente.i.synchroniser();
  });
  runApp(const Application());
}

class Application extends StatelessWidget {
  const Application({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Etat.i,
      builder: (context, _) => MaterialApp(
        title: 'CETIC de Mezesse',
        debugShowCheckedModeBanner: false,
        theme: construireTheme(Brightness.light),
        darkTheme: construireTheme(Brightness.dark),
        themeMode: Etat.i.theme,
        home: const Accueil(),
      ),
    );
  }
}

class Accueil extends StatelessWidget {
  const Accueil({super.key});

  @override
  Widget build(BuildContext context) {
    final e = Etat.i;
    if (e.demarrage) {
      return const MotifFond(child: Scaffold(body: Center(child: CircularProgressIndicator(strokeWidth: 2.5))));
    }
    if (e.utilisateur == null) return const EcranConnexion();
    if (e.utilisateur!['doitChangerMotDePasse'] == true) return const EcranMotDePasse(obligatoire: true);
    return ValueListenableBuilder(valueListenable: Api.i.horsLigne, builder: (_, __, ___) => const Coquille());
  }
}
