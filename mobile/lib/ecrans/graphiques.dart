// Graphiques : mêmes formes et mêmes couleurs que sur le web.
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../format.dart';
import '../theme.dart';

class Repartition extends StatelessWidget {
  const Repartition(this.donnees, {super.key});
  final List donnees; // [{tranche, effectif}]

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final max = donnees.fold<int>(1, (m, d) => (d['effectif'] as int) > m ? d['effectif'] as int : m);
    return SizedBox(
      height: 190,
      child: BarChart(BarChartData(
        maxY: max * 1.15,
        gridData: FlGridData(drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: c.grille, strokeWidth: 1)),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 26,
              getTitlesWidget: (v, m) => v % 1 == 0 && v <= max
                  ? Text('${v.toInt()}', style: TextStyle(fontSize: 10.5, color: c.encre2))
                  : const SizedBox(),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, m) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(donnees[v.toInt()]['tranche'] as String, style: TextStyle(fontSize: 10, color: c.encre2)),
              ),
            ),
          ),
        ),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (g, _, r, __) => BarTooltipItem('${r.toY.toInt()} élèves', const TextStyle(color: Colors.white, fontSize: 12)),
          ),
        ),
        barGroups: [
          for (var i = 0; i < donnees.length; i++)
            BarChartGroupData(x: i, barRods: [
              BarChartRodData(
                toY: (donnees[i]['effectif'] as int).toDouble(),
                width: 20,
                color: i < 3 ? c.serie1.withValues(alpha: 0.45) : c.serie1,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              ),
            ]),
        ],
      )),
    );
  }
}

class Evolution extends StatelessWidget {
  const Evolution(this.donnees, {super.key});
  final List donnees; // [{periode, moyenne}]

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final points = <FlSpot>[
      for (var i = 0; i < donnees.length; i++)
        if (donnees[i]['moyenne'] != null) FlSpot(i.toDouble(), (donnees[i]['moyenne'] as num).toDouble()),
    ];
    return SizedBox(
      height: 190,
      child: LineChart(LineChartData(
        minY: 0,
        maxY: 20,
        minX: 0,
        maxX: (donnees.length - 1).toDouble(),
        gridData: FlGridData(drawVerticalLine: false, horizontalInterval: 5, getDrawingHorizontalLine: (_) => FlLine(color: c.grille, strokeWidth: 1)),
        borderData: FlBorderData(show: false),
        extraLinesData: ExtraLinesData(horizontalLines: [HorizontalLine(y: 10, color: c.encre3, strokeWidth: 1, dashArray: [4, 4])]),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 5,
              reservedSize: 26,
              getTitlesWidget: (v, m) => Text('${v.toInt()}', style: TextStyle(fontSize: 10.5, color: c.encre2)),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 1,
              getTitlesWidget: (v, m) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(donnees[v.toInt()]['periode'] as String, style: TextStyle(fontSize: 10.5, color: c.encre2)),
              ),
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (s) => s.map((p) => LineTooltipItem('${note(p.y)} / 20', const TextStyle(color: Colors.white, fontSize: 12))).toList(),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: points,
            color: c.serie1,
            barWidth: 2,
            dotData: FlDotData(
              getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(radius: 4, color: c.serie1, strokeWidth: 2, strokeColor: Theme.of(context).colorScheme.surface),
            ),
          ),
        ],
      )),
    );
  }
}

/// Filles et garçons : moyenne sur 20 et taux de réussite, en barres horizontales.
class ParSexe extends StatelessWidget {
  const ParSexe(this.donnees, {super.key});
  final List donnees; // [{sexe, effectif, moyenne, tauxReussite}]

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Map? ligne(String s) {
      for (final d in donnees) {
        if (d['sexe'] == s) return d as Map;
      }
      return null;
    }

    final items = [('Filles', c.serie2, ligne('F')), ('Garçons', c.serie1, ligne('M'))];
    Widget bloc(String titre, double max, String cle, String Function(num?) fmt) =>
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(titre.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.6, color: c.encre2)),
          const SizedBox(height: 6),
          for (final (nom, couleur, d) in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                SizedBox(width: 92, child: Text('$nom (${d?['effectif'] ?? 0})', style: TextStyle(fontSize: 13, color: c.encre2))),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: ((d?[cle] as num?) ?? 0) / max,
                      minHeight: 10,
                      color: couleur,
                      backgroundColor: c.surface2,
                    ),
                  ),
                ),
                SizedBox(
                  width: 72,
                  child: Text(fmt(d?[cle] as num?), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                ),
              ]),
            ),
        ]);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      bloc('Moyenne', 20, 'moyenne', (v) => v == null ? '—' : '${note(v)}/20'),
      const SizedBox(height: 10),
      bloc('Taux de réussite', 100, 'tauxReussite', pourcent),
    ]);
  }
}

/// Moyennes (sur 20) en barres horizontales, avec la valeur au bout.
class BarresMoyennes extends StatelessWidget {
  const BarresMoyennes(this.lignes, {super.key});
  final List<(String, num?)> lignes;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(children: [
      for (final (nom, v) in lignes.where((l) => l.$2 != null))
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(nom, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
              Text(note(v), style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: v! < 10 ? c.danger : null)),
            ]),
            const SizedBox(height: 3),
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: v / 20,
                minHeight: 8,
                color: v < 10 ? c.serie1.withValues(alpha: 0.45) : c.serie1,
                backgroundColor: c.surface2,
              ),
            ),
          ]),
        ),
    ]);
  }
}
