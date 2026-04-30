import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(filePath));
        } else { 
            if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
                results.push(filePath);
            }
        }
    });
    return results;
}

const files = walkDir('./src');
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Convert hardcoded dark mode backgrounds to theme-aware background
    content = content.replace(/bg-\[\#0f0c1b\]/g, 'bg-transparent');
    content = content.replace(/bg-\[\#161421\]/g, 'bg-theme-surface');
    content = content.replace(/bg-\[\#1c1a27\]/g, 'bg-theme-surface');
    
    // Replace text colors carefully
    // We want to replace text-white with text-theme-primary EXCEPT when it's on a dark background button (like bg-indigo-500)
    // A simple heuristic: if the className contains bg-indigo, bg-emerald, bg-red, bg-purple, bg-pink, bg-amber, bg-orange, bg-cyan, bg-blue
    // we should NOT replace text-white with text-theme-primary.
    // Instead of complex regex, we can process line by line or class-string by class-string.

    const classStringRegex = /className=(["'])(.*?)\1|className=\{clsx\(([\s\S]*?)\)\}/g;
    
    content = content.replace(classStringRegex, (match) => {
        let newMatch = match;
        const hasSolidBg = /(bg-(indigo|emerald|red|purple|pink|amber|orange|cyan|blue|green)-[4-9]00)/.test(newMatch);
        const hasGradient = /bg-gradient-to/.test(newMatch);
        
        if (!hasSolidBg && !hasGradient) {
            newMatch = newMatch.replace(/\btext-white\b/g, 'text-theme-primary');
        }

        // Always replace gray text with theme semantic text
        newMatch = newMatch.replace(/\btext-gray-300\b/g, 'text-theme-secondary');
        newMatch = newMatch.replace(/\btext-gray-400\b/g, 'text-theme-muted');
        newMatch = newMatch.replace(/\btext-gray-500\b/g, 'text-theme-muted');
        
        // Backgrounds
        newMatch = newMatch.replace(/\bbg-white\/5\b/g, 'bg-theme-surface');
        newMatch = newMatch.replace(/\bbg-white\/10\b/g, 'bg-theme-surface-2');
        newMatch = newMatch.replace(/\bbg-white\/20\b/g, 'bg-theme-surface-2');
        
        // Borders
        newMatch = newMatch.replace(/\bborder-white\/5\b/g, 'border-theme-border');
        newMatch = newMatch.replace(/\bborder-white\/10\b/g, 'border-theme-border');
        newMatch = newMatch.replace(/\bborder-white\/20\b/g, 'border-theme-border');

        return newMatch;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated ' + file);
        changedCount++;
    }
});

console.log(`Updated ${changedCount} files.`);
