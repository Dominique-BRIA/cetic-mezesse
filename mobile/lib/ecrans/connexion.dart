import 'package:flutter/material.dart';

import '../api.dart';
import '../etat.dart';
import '../motif.dart';
import '../theme.dart';
import '../widgets.dart';

class Marque extends StatelessWidget {
  const Marque({super.key, this.compacte = false});
  final bool compacte;

  @override
  Widget build(BuildContext context) {
    final p = Theme.of(context).colorScheme.primary;
    final t = compacte ? 30.0 : 38.0;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: t,
        height: t,
        decoration: BoxDecoration(color: p, borderRadius: BorderRadius.circular(6)),
        child: CustomPaint(painter: _Signe(Theme.of(context).colorScheme.onPrimary)),
      ),
      const SizedBox(width: 10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text('CETIC de Mezessé', style: TextStyle(fontWeight: FontWeight.w700, fontSize: compacte ? 15 : 16.5)),
        if (!compacte) Text('Gestion scolaire', style: TextStyle(fontSize: 12, color: context.c.encre2)),
      ]),
    ]);
  }
}

// Équerre et règle, comme sur le web.
class _Signe extends CustomPainter {
  _Signe(this.couleur);
  final Color couleur;
  @override
  void paint(Canvas canvas, Size s) {
    final k = s.width / 32;
    final p = Paint()
      ..color = couleur
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2 * k
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(Path()..moveTo(8 * k, 23 * k)..lineTo(8 * k, 9 * k)..lineTo(19 * k, 23 * k)..close(), p);
    canvas.drawLine(Offset(21 * k, 9 * k), Offset(21 * k, 23 * k), p);
    canvas.drawLine(Offset(18 * k, 12 * k), Offset(24 * k, 12 * k), p);
  }

  @override
  bool shouldRepaint(_Signe o) => o.couleur != couleur;
}

class EcranConnexion extends StatefulWidget {
  const EcranConnexion({super.key});
  @override
  State<EcranConnexion> createState() => _EcranConnexionState();
}

class _EcranConnexionState extends State<EcranConnexion> {
  final _id = TextEditingController();
  final _mdp = TextEditingController();
  bool _voir = false;
  bool _envoi = false;
  String? _erreur;

  Future<void> _connecter() async {
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      final r = await Api.i.envoyer('POST', '/auth/connexion',
          corps: {'identifiant': _id.text.trim(), 'motDePasse': _mdp.text}, annee: false) as Map;
      await Etat.i.connecter(r['jeton'] as String, (r['utilisateur'] as Map).cast<String, dynamic>());
    } on ErreurApi catch (e) {
      setState(() => _erreur = e.message);
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return MotifFond(
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Marque(),
                        const SizedBox(height: 14),
                        Text('RÉPUBLIQUE DU CAMEROUN · MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES',
                            style: TextStyle(fontSize: 10.5, letterSpacing: 0.8, fontWeight: FontWeight.w600, color: c.encre3)),
                        Text('SANGMÉLIMA · DJA-ET-LOBO · SUD', style: TextStyle(fontSize: 10.5, letterSpacing: 0.8, color: c.encre3)),
                      ]),
                    ),
                    const Divider(),
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: AutofillGroup(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          const Text('Connexion', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                          Text('Avec votre téléphone ou votre adresse électronique.', style: TextStyle(color: c.encre2)),
                          const SizedBox(height: 16),
                          if (_erreur != null) ...[MessageErreur(_erreur!), const SizedBox(height: 12)],
                          TextField(
                            controller: _id,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.username],
                            decoration: const InputDecoration(labelText: 'Téléphone ou e-mail'),
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _mdp,
                            obscureText: !_voir,
                            autofillHints: const [AutofillHints.password],
                            onSubmitted: (_) => _connecter(),
                            decoration: InputDecoration(
                              labelText: 'Mot de passe',
                              suffixIcon: IconButton(
                                icon: Icon(_voir ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                                onPressed: () => setState(() => _voir = !_voir),
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),
                          FilledButton(
                            onPressed: _envoi ? null : _connecter,
                            child: _envoi
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Text('Se connecter'),
                          ),
                          const SizedBox(height: 12),
                          Text('Mot de passe oublié ? Adressez-vous au Surveillant Général.', style: TextStyle(fontSize: 12, color: c.encre3)),
                        ]),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class EcranMotDePasse extends StatefulWidget {
  const EcranMotDePasse({super.key, this.obligatoire = false});
  final bool obligatoire;
  @override
  State<EcranMotDePasse> createState() => _EcranMotDePasseState();
}

class _EcranMotDePasseState extends State<EcranMotDePasse> {
  final _ancien = TextEditingController();
  final _nouveau = TextEditingController();
  final _confirmation = TextEditingController();
  String? _erreur;
  bool _envoi = false;

  Future<void> _enregistrer() async {
    if (_nouveau.text != _confirmation.text) {
      setState(() => _erreur = 'Les deux nouveaux mots de passe ne sont pas identiques.');
      return;
    }
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      await Api.i.envoyer('POST', '/auth/mot-de-passe', corps: {'ancien': _ancien.text, 'nouveau': _nouveau.text}, annee: false);
      await Etat.i.rafraichirProfil();
      if (mounted) {
        message(context, 'Mot de passe modifié.');
        if (!widget.obligatoire) Navigator.pop(context);
      }
    } on ErreurApi catch (e) {
      setState(() => _erreur = e.message);
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final formulaire = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (_erreur != null) ...[MessageErreur(_erreur!), const SizedBox(height: 12)],
      TextField(controller: _ancien, obscureText: true, decoration: const InputDecoration(labelText: 'Mot de passe actuel')),
      const SizedBox(height: 12),
      TextField(controller: _nouveau, obscureText: true, decoration: const InputDecoration(labelText: 'Nouveau mot de passe', helperText: '8 caractères au moins')),
      const SizedBox(height: 12),
      TextField(controller: _confirmation, obscureText: true, decoration: const InputDecoration(labelText: 'Confirmez le nouveau mot de passe')),
      const SizedBox(height: 18),
      FilledButton(onPressed: _envoi ? null : _enregistrer, child: const Text('Enregistrer')),
      if (widget.obligatoire) TextButton(onPressed: Etat.i.deconnecter, child: const Text('Se déconnecter')),
    ]);
    return MotifFond(
      child: Scaffold(
        appBar: widget.obligatoire ? null : AppBar(title: const Text('Changer mon mot de passe')),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (widget.obligatoire) ...[
                    const Marque(),
                    const SizedBox(height: 18),
                    const Text('Choisissez votre mot de passe', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('Votre compte utilise le mot de passe provisoire. Remplacez-le avant de continuer.',
                        style: TextStyle(color: context.c.encre2)),
                    const SizedBox(height: 16),
                  ],
                  formulaire,
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
