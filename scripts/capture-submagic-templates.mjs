/**
 * Script pour capturer les templates Submagic à haute résolution
 * Usage: node scripts/capture-submagic-templates.mjs
 * 
 * 1. Le script ouvre un navigateur
 * 2. Tu te connectes à Submagic
 * 3. Tu navigues vers un projet avec l'onglet Caption
 * 4. Tu tapes "go" dans le terminal
 * 5. Le script capture tous les templates
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../public/submagic-templates');

// Templates à capturer (class interne -> nom fichier)
const TEMPLATES = {
  'laura': 'Laura',
  'kunman': 'Kelly 2',
  'caleb': 'Caleb',
  'kendrick': 'Kendrick',
  'salma': 'Lewis',
  'doug': 'Doug',
  'carlos': 'Carlos',
  'luke': 'Luke',
  'mark': 'Mark',
  'sara': 'Sara',
  'daniel': 'Daniel',
  'dan2': 'Dan 2',
  'alex': 'Hormozi 4',
  'dan': 'Dan',
  'submagic_business': 'Devin',
  'tayo': 'Tayo',
  'ella': 'Ella',
  'tracy': 'Tracy',
  'oussama': 'Hormozi 1',
  'flowless': 'Hormozi 2',
  'hormozi3': 'Hormozi 3',
  'tatum': 'Hormozi 5',
  'submagic': 'William',
  'leon': 'Leon',
  'ali': 'Ali',
  'beast': 'Beast',
  'maya': 'Maya',
  'karl': 'Karl',
  'cleancut': 'Iman',
  'saveur': 'David',
  'noah': 'Noah',
  'constance': 'Gstaad',
  'celine': 'Nema',
};

// Helper pour attendre une entrée utilisateur
function waitForInput(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  // Créer le dossier de sortie
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       CAPTURE DES TEMPLATES SUBMAGIC                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  
  // Aller sur Submagic
  console.log('🚀 Ouverture de Submagic...');
  await page.goto('https://app.submagic.co/', { waitUntil: 'networkidle2' });

  console.log('');
  console.log('📝 INSTRUCTIONS:');
  console.log('   1. Connecte-toi à Submagic dans le navigateur qui s\'est ouvert');
  console.log('   2. Ouvre un projet et va dans l\'onglet "Caption"');
  console.log('   3. Assure-toi que la grille de templates est visible');
  console.log('');
  
  await waitForInput('👉 Tape ENTRÉE quand tu es prêt... ');

  // Vérifier que les templates sont présents
  console.log('');
  console.log('🔍 Recherche des templates...');
  
  try {
    await page.waitForSelector('.button-template-laura', { timeout: 10000 });
    console.log('✅ Templates trouvés !');
  } catch (e) {
    console.log('❌ Templates non trouvés. Assure-toi d\'être sur la page Caption avec les templates visibles.');
    await waitForInput('👉 Tape ENTRÉE pour réessayer... ');
    
    try {
      await page.waitForSelector('.button-template-laura', { timeout: 10000 });
      console.log('✅ Templates trouvés !');
    } catch (e2) {
      console.log('❌ Toujours pas trouvé. Fermeture.');
      await browser.close();
      return;
    }
  }

  console.log('');
  console.log('📸 Capture des templates en cours...');
  console.log('');

  // Capturer chaque template
  let captured = 0;
  let errors = 0;
  const total = Object.keys(TEMPLATES).length;

  for (const [className, templateName] of Object.entries(TEMPLATES)) {
    const selector = `.button-template-${className}`;
    
    try {
      const element = await page.$(selector);
      
      if (element) {
        // Nom du fichier (slugify)
        const fileName = templateName.toLowerCase().replace(/\s+/g, '-') + '.png';
        const filePath = path.join(OUTPUT_DIR, fileName);
        
        // Capturer l'élément
        await element.screenshot({
          path: filePath,
          type: 'png',
        });
        
        captured++;
        console.log(`   ✓ [${captured}/${total}] ${templateName}`);
      } else {
        errors++;
        console.log(`   ✗ [${captured}/${total}] ${templateName} - non trouvé`);
      }
    } catch (err) {
      errors++;
      console.log(`   ✗ [${captured}/${total}] ${templateName} - erreur: ${err.message}`);
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`✅ Terminé ! ${captured}/${total} templates capturés.`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} erreurs.`);
  }
  console.log(`📁 Dossier: ${OUTPUT_DIR}`);
  console.log('════════════════════════════════════════════════════════════');

  await waitForInput('👉 Tape ENTRÉE pour fermer le navigateur... ');
  await browser.close();
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
