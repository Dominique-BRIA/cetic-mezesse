import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'ecrans/coquille.dart';
import 'ecrans/connexion.dart';
import 'etat.dart';
import 'file_attente.dart';
import 'journal.dart';
import 'motif.dart';
import 'theme.dart';

void main() {
  runZonedGuarded(() {
    WidgetsFlutterBinding.ensureInitialized();
    noter('main : lancement (API ${Api.base})');
    FlutterError.onError = (d) {
      noter('ERREUR Flutter : ${d.exceptionAsString()}');
      FlutterError.presentError(d);
    };
    Etat.i.demarrer();
    // Nouvelle tentative d'envoi des notes en attente toutes les minutes.
    Timer.periodic(const Duration(minutes: 1), (_) {
      if (FileAttente.i.envois.isNotEmpty) FileAttente.i.synchroniser();
    });
    runApp(const Application());
    noter('main : interface lancée');
  }, (e, pile) => noter('ERREUR non interceptée : $e'));
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
        builder: (context, enfant) => journalActif
            ? Stack(children: [enfant ?? const SizedBox(), const PanneauJournal()])
            : enfant ?? const SizedBox(),
      ),
    );
  }
}

class Accueil extends StatelessWidget {
  const Accueil({super.key});

  @override
  Widget build(BuildContext context) {
    final e = Etat.i;
    noter('écran : ${e.demarrage ? 'chargement' : e.utilisateur == null ? 'connexion' : 'accueil (${e.role})'}');
    if (e.demarrage) {
      return const MotifFond(child: Scaffold(body: Center(child: CircularProgressIndicator(strokeWidth: 2.5))));
    }
    if (e.utilisateur == null) return const EcranConnexion();
    if (e.utilisateur!['doitChangerMotDePasse'] == true) return const EcranMotDePasse(obligatoire: true);
    return ValueListenableBuilder(valueListenable: Api.i.horsLigne, builder: (_, __, ___) => const Coquille());
  }
}
