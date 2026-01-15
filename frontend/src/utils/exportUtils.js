/**
 * Utilitaires d'export PDF et Excel pour Eco-Logistics Algeria
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Exporte un rapport de prédiction en PDF
 */
export const exportPredictionToPDF = (prediction, carbonData, routeData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // En-tête
  doc.setFillColor(0, 98, 51); // Vert Algérie
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('Eco-Logistics Algeria', pageWidth / 2, 18, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Rapport de Prédiction & Empreinte Carbone', pageWidth / 2, 28, { align: 'center' });

  // Date
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, 36, { align: 'center' });

  let yPos = 50;

  // Section Prédiction ML
  if (prediction) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Prédiction Machine Learning', 14, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    const predictionData = [
      ['Origine', prediction.input_features?.origin || '-'],
      ['Destination', prediction.input_features?.destination || '-'],
      ['Distance', `${prediction.input_features?.distance_km || 0} km`],
      ['Tonnage', `${prediction.input_features?.cargo_tonnes || 0} tonnes`],
      ['Type de cargo', prediction.input_features?.cargo_type || '-'],
      ['Mode recommandé', prediction.predicted_mode?.replace('_', ' ').toUpperCase() || '-'],
      ['Confiance', `${((prediction.confidence || 0) * 100).toFixed(1)}%`],
      ['Rail disponible', prediction.input_features?.rail_available ? 'Oui' : 'Non'],
      ['Zone origine', prediction.input_features?.origin_zone || '-'],
      ['Zone destination', prediction.input_features?.dest_zone || '-']
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Paramètre', 'Valeur']],
      body: predictionData,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] }, // Purple
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Section Empreinte Carbone
  if (carbonData) {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Comparaison Empreinte Carbone', 14, yPos);
    yPos += 10;

    const carbonTableData = Object.entries(carbonData)
      .filter(([_, value]) => !value.error)
      .map(([mode, value]) => [
        mode.replace('_', ' ').toUpperCase(),
        `${value.total_co2_kg?.toLocaleString() || 0} kg`,
        value.n_vehicles || 1,
        mode === prediction?.predicted_mode ? '⭐ Recommandé' : ''
      ])
      .sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));

    doc.autoTable({
      startY: yPos,
      head: [['Mode de Transport', 'CO2 Total', 'Véhicules', 'Statut']],
      body: carbonTableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }, // Green
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Section Route
  if (routeData) {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Itinéraire OSRM', 14, yPos);
    yPos += 10;

    const routeTableData = [
      ['Distance réelle', `${routeData.distance_km || 0} km`],
      ['Durée estimée', `${Math.round(routeData.duration_minutes || 0)} minutes`],
      ['Points de passage', routeData.waypoints?.length || 2]
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Information', 'Valeur']],
      body: routeTableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }, // Blue
      margin: { left: 14, right: 14 }
    });
  }

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} sur ${pageCount} - Eco-Logistics Algeria`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Télécharger
  const filename = `rapport_prediction_${prediction?.input_features?.origin || 'origine'}_${prediction?.input_features?.destination || 'dest'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  return filename;
};

/**
 * Exporte les données en Excel
 */
export const exportToExcel = (prediction, carbonData, routeData, optimizationResult) => {
  const workbook = XLSX.utils.book_new();

  // Feuille 1: Prédiction
  if (prediction) {
    const predictionSheet = XLSX.utils.json_to_sheet([
      {
        'Origine': prediction.input_features?.origin,
        'Destination': prediction.input_features?.destination,
        'Distance (km)': prediction.input_features?.distance_km,
        'Tonnage': prediction.input_features?.cargo_tonnes,
        'Type Cargo': prediction.input_features?.cargo_type,
        'Mode Recommandé': prediction.predicted_mode,
        'Confiance (%)': (prediction.confidence * 100).toFixed(1),
        'Rail Disponible': prediction.input_features?.rail_available ? 'Oui' : 'Non',
        'Zone Origine': prediction.input_features?.origin_zone,
        'Zone Destination': prediction.input_features?.dest_zone
      }
    ]);
    XLSX.utils.book_append_sheet(workbook, predictionSheet, 'Prédiction ML');
  }

  // Feuille 2: Comparaison CO2
  if (carbonData) {
    const carbonRows = Object.entries(carbonData)
      .filter(([_, value]) => !value.error)
      .map(([mode, value]) => ({
        'Mode Transport': mode.replace('_', ' '),
        'CO2 Total (kg)': value.total_co2_kg,
        'Véhicules': value.n_vehicles || 1,
        'CO2/km (kg)': value.co2_per_km?.toFixed(3) || '-',
        'Recommandé ML': mode === prediction?.predicted_mode ? 'Oui' : 'Non'
      }));

    const carbonSheet = XLSX.utils.json_to_sheet(carbonRows);
    XLSX.utils.book_append_sheet(workbook, carbonSheet, 'Empreinte CO2');
  }

  // Feuille 3: Route
  if (routeData) {
    const routeSheet = XLSX.utils.json_to_sheet([
      {
        'Origine': routeData.origin,
        'Destination': routeData.destination,
        'Distance (km)': routeData.distance_km,
        'Durée (min)': Math.round(routeData.duration_minutes || 0)
      }
    ]);
    XLSX.utils.book_append_sheet(workbook, routeSheet, 'Itinéraire');
  }

  // Feuille 4: Optimisation (si disponible)
  if (optimizationResult?.pareto_front) {
    const paretoRows = optimizationResult.pareto_front.map((solution, idx) => ({
      'Solution #': idx + 1,
      'Coût Total (DZD)': solution.total_cost_dzd,
      'CO2 Total (kg)': solution.total_co2_kg,
      'Recommandée': idx === 0 ? 'Oui' : 'Non'
    }));

    const paretoSheet = XLSX.utils.json_to_sheet(paretoRows);
    XLSX.utils.book_append_sheet(workbook, paretoSheet, 'Front Pareto');
  }

  // Générer le fichier
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const filename = `eco_logistics_rapport_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, filename);

  return filename;
};

/**
 * Exporte un rapport d'optimisation complet en PDF
 */
export const exportOptimizationToPDF = (optimizationResult, clusters) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // En-tête
  doc.setFillColor(0, 98, 51);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('Eco-Logistics Algeria', pageWidth / 2, 18, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Rapport d\'Optimisation Multi-Objectif', pageWidth / 2, 28, { align: 'center' });

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 36, { align: 'center' });

  let yPos = 50;

  // Résumé
  if (optimizationResult?.recommended_solution) {
    const rec = optimizationResult.recommended_solution;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Solution Recommandée', 14, yPos);
    yPos += 10;

    doc.autoTable({
      startY: yPos,
      head: [['Métrique', 'Valeur']],
      body: [
        ['Coût Total', `${rec.total_cost_dzd?.toLocaleString()} DZD`],
        ['Émissions CO2', `${rec.total_co2_kg?.toLocaleString()} kg`],
        ['Solutions Pareto', optimizationResult.pareto_front?.length || 0]
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 98, 51] },
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Clusters
  if (clusters?.length > 0) {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Hubs Logistiques (K-Means)', 14, yPos);
    yPos += 10;

    const clusterData = clusters.map((c, idx) => [
      idx + 1,
      c.hub_name,
      c.wilayas_covered?.length || 0,
      `${c.total_demand?.toLocaleString()} t`
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['#', 'Hub', 'Wilayas', 'Demande/mois']],
      body: clusterData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 }
    });
  }

  const filename = `rapport_optimisation_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  return filename;
};

export default {
  exportPredictionToPDF,
  exportToExcel,
  exportOptimizationToPDF
};
