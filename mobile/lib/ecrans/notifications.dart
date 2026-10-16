import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

// Cloche des notifications (RG-32) : relevée chaque minute, la liste s'ouvre en feuille du bas.

class ClocheNotifications extends StatefulWidget {
  const ClocheNotifications({super.key, required this.ouvrir});

  /// Ouvre l'écran correspondant au lien d'une notification (« /saisie » → « saisie »).
  final void Function(String cle) ouvrir;

  @override
  State<ClocheNotifications> createState() => _ClocheNotificationsState();
}

class _ClocheNotificationsState extends State<ClocheNotifications> {
  List<Map<String, dynamic>> _liste = [];
  int _nonLues = 0;
  Timer? _minuterie;

  @override
  void initState() {
    super.initState();
    _charger();
    _minuterie = Timer.periodic(const Duration(minutes: 1), (_) => _charger());
  }

  @override
  void dispose() {
    _minuterie?.cancel();
    super.dispose();
  }

  Future<void> _charger() async {
    try {
      final r = await Api.i.get('/notifications', annee: false) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _liste = (r['notifications'] as List).cast<Map<String, dynamic>>();
        _nonLues = r['nonLues'] as int;
      });
    } catch (_) {
      // hors connexion : on garde la dernière liste
    }
  }

  Future<void> _lire(String? id) async {
    try {
      await Api.i.envoyer('POST', id == null ? '/notifications/lues' : '/notifications/$id/lue', annee: false);
    } catch (_) {}
    await _charger();
  }

  String _quand(String iso) {
    final d = DateTime.parse(iso).toLocal();
    String deux(int n) => n.toString().padLeft(2, '0');
    return '${deux(d.day)}/${deux(d.month)} ${deux(d.hour)}:${deux(d.minute)}';
  }

  void _ouvrirListe() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, maj) => SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
                child: Row(children: [
                  const Expanded(child: Text('Notifications', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                  if (_nonLues > 0)
                    TextButton(
                      onPressed: () async {
                        await _lire(null);
                        maj(() {});
                      },
                      child: const Text('Tout marquer comme lu'),
                    ),
                ]),
              ),
              if (_liste.isEmpty)
                const Padding(padding: EdgeInsets.only(bottom: 24), child: Vide('Aucune notification'))
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: _liste.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (ctx, i) {
                      final n = _liste[i];
                      final lue = n['lue'] == true;
                      return ListTile(
                        tileColor: lue ? null : ctx.c.primairePale,
                        title: Row(children: [
                          Expanded(
                            child: Text(n['titre'] as String,
                                style: TextStyle(fontWeight: FontWeight.w700, color: lue ? null : Theme.of(ctx).colorScheme.primary)),
                          ),
                          Text(_quand(n['creeLe'] as String), style: TextStyle(fontSize: 11, color: ctx.c.encre3)),
                        ]),
                        subtitle: Text(n['message'] as String),
                        onTap: () async {
                          if (!lue) await _lire(n['id'] as String);
                          final lien = n['lien'] as String?;
                          if (lien != null && ctx.mounted) {
                            Navigator.pop(ctx);
                            widget.ouvrir(lien.split('?').first.replaceAll('/', ''));
                          } else {
                            maj(() {});
                          }
                        },
                      );
                    },
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () async {
        await _charger();
        if (mounted) _ouvrirListe();
      },
      icon: Badge(
        isLabelVisible: _nonLues > 0,
        label: Text(_nonLues > 9 ? '9+' : '$_nonLues'),
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
