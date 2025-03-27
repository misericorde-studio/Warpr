import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


// Configuration
const config = {
    // Paramètres des cercles
    innerRadius: 0.50,           // Rayon du cercle intérieur
    outerRadius: 4.80,           // Rayon du cercle extérieur
    
    // Paramètres des particules
    innerCircleParticles: 100, // Nombre de particules dans le cercle intérieur
    outerCircleParticles: 2000, // Nombre de particules dans le cercle extérieur (augmenté)
    baseParticleSize: 0.60,    // Taille de base des particules
    outerCircleParticleSize: 0.75,     // Grosses particules pour le cercle principal
    outerCircleBorderParticleSize: 0.75, // Petites particules pour les bordures
    
    // Paramètres des bordures
    innerBorderWidth: 0.30,  // Largeur de la bordure intérieure
    outerBorderWidth: 0.30,  // Largeur de la bordure extérieure
    innerBorderParticleRatio: 0.20, // Ratio de particules pour les bordures
    outerBorderParticleRatio: 0.20,
    
    // Paramètres visuels
    perspectiveEffect: 0,   // Effet de perspective (0-1)
    staticRingWidth: 0.75,     // Largeur de l'anneau statique du cercle extérieur
    outerOutwardRatio: 0.6,   // Proportion de particules se déplaçant vers l'extérieur
    innerCircleFill: 0.8,     // Proportion du rayon intérieur à remplir
    
    // Paramètres d'animation
    maxParticleDistance: 1,   // Distance maximale que peuvent parcourir les particules
    particleSpeed: 0.005,      // Vitesse de déplacement des particules
    fadeWithDistance: 1,      // Réduction de taille avec la distance (0-1)
    
    // Paramètres de couleur
    particleColor: 0xffffff,  // Couleur des particules (blanc)
    splitCircleColor: 0x00ffcc, // Couleur du cercle qui se scinde
    
    // NOUVEAU: Paramètres de gestion du flux de particules
    minMobileRatio: 0.7,      // Ratio minimum de particules mobiles
    
    // NOUVEAU: Paramètres pour les cercles supplémentaires
    additionalCircles: 4,      // 3 blancs + 1 vert (le cercle intérieur compte comme un blanc)
    whiteCircleParticles: 100, // Nombre de particules pour les cercles blancs
    greenCircleParticles: 100, // Nombre de particules pour le cercle vert
    whiteCircleParticleScale: 0.8, // Facteur d'échelle pour les particules des cercles blancs
    greenCircleParticleScale: 0.9, // Facteur d'échelle pour les particules du cercle vert
    additionalCircleVerticalSpacing: 0.5, // Espacement vertical entre les cercles
    
    // NOUVEAU: Paramètres pour les bordures des cercles additionnels
    additionalCircleBorderRatio: 0.45, // Ratio de particules pour les bordures des cercles additionnels
    additionalCircleBorderScale: 0.4,  // Échelle des particules de bordure pour les cercles additionnels
    additionalCircleBorderWidth: 0.15,  // Largeur des bordures des cercles additionnels
    
    // Configuration pour l'animation de division
    splitAnimation: {
        gridSize: 3, // 3x3 grid
        spacing: 1.25, // Espacement entre les cercles
        circleRadius: 0.15, // Rayon plus petit des petits cercles (était 0.2)
        circleFill: 0.9, // Remplissage des petits cercles (0-1)
        transitionDuration: 1.0, // Durée de la transition
        active: false, // État de l'animation
        particleScale: 0.3, // Facteur d'échelle plus petit pour les particules des cercles de fin (était 0.5)
        currentSizeMultiplier: 1.0, // Variable pour contrôler la taille actuelle des particules en fonction du scroll
        otherCirclesOpacity: 1.0, // Opacité des autres cercles verticaux (contrôlée par le scroll)
        borderParticleRatio: 0.6,    // Ratio de particules pour les bordures des petits cercles (augmenté de 0.35 à 0.6)
        borderParticleScale: 0.3,     // Échelle des particules de bordure pour les petits cercles
    }
};

// Configuration de la caméra avec un champ de vision adapté
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Configuration de l'animation au scroll
const scrollConfig = {
    startRotationX: 90,  // Rotation X initiale en degrés (vue de dessus)
    endRotationX: 11,    // Rotation X finale en degrés pour le premier mouvement
    startDistance: 13,   // Distance initiale
    endDistance: 4.45,   // Distance finale
    
    // NOUVEAU: Configuration pour les étapes de l'animation
    splitStart: 0, // Début de l'animation de division (sera mis à jour dans updateCameraFromScroll)
    splitEnd: 1,   // Fin de l'animation de division (sera mis à jour dans updateCameraFromScroll)
};

console.log("Configuration de l'animation au scroll:", scrollConfig);

// Initialisation de la scène, caméra et renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0C0E13);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0C0E13, 1);
// Utiliser l'espace sRGB pour correspondre au CSS
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

// Contrôles d'orbite
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false;

// Déclaration des variables globales
let particles;
let innerParticles;  // Nouveau: tableau pour les particules intérieures
let outerParticles;  // Nouveau: tableau pour les particules extérieures
let innerGeometry;   // Nouveau: géométrie pour les cercles intérieurs
let outerGeometry;   // Nouveau: géométrie pour le cercle extérieur
let innerMaterial;   // Nouveau: matériau pour les cercles intérieurs
let outerMaterial;   // Nouveau: matériau pour le cercle extérieur
let particlesGroup;
let outerCircleGroup;

// Animation
let frameCount = 0; // Compteur de frames pour diagnostic et performances
let lastTime = performance.now();
let fpsTime = 0;
const fpsUpdateInterval = 500; // Mettre à jour les FPS toutes les 500ms

// Variable pour suivre si l'utilisateur a commencé à défiler
let hasScrolled = false;

function init() {
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(renderer.domElement);
        
        // Positionner la caméra de manière fixe
        camera.position.set(0, 0, scrollConfig.startDistance);
        camera.lookAt(0, 0, 0);
        
        // Créer les particules
        particles = createParticles();
        
        // Séparer les particules en deux groupes
        outerParticles = particles.filter(p => !p.isInnerCircle && !p.isAdditionalCircle);
        innerParticles = particles.filter(p => p.isInnerCircle || p.isAdditionalCircle);
        
        // Créer les géométries
        innerGeometry = new THREE.BufferGeometry();
        outerGeometry = new THREE.BufferGeometry();
        
        // Initialiser les attributs pour la géométrie extérieure
        const outerPositions = new Float32Array(outerParticles.length * 3);
        const outerSizes = new Float32Array(outerParticles.length);
        const outerColors = new Float32Array(outerParticles.length * 3);
        const outerOpacities = new Float32Array(outerParticles.length);
        
        // Initialiser les attributs pour la géométrie intérieure
        const innerPositions = new Float32Array(innerParticles.length * 3);
        const innerSizes = new Float32Array(innerParticles.length);
        const innerColors = new Float32Array(innerParticles.length * 3);
        const innerOpacities = new Float32Array(innerParticles.length);
        
        // Configurer les attributs des géométries
        outerGeometry.setAttribute('position', new THREE.BufferAttribute(outerPositions, 3));
        outerGeometry.setAttribute('size', new THREE.BufferAttribute(outerSizes, 1));
        outerGeometry.setAttribute('color', new THREE.BufferAttribute(outerColors, 3));
        outerGeometry.setAttribute('opacity', new THREE.BufferAttribute(outerOpacities, 1));
        
        innerGeometry.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
        innerGeometry.setAttribute('size', new THREE.BufferAttribute(innerSizes, 1));
        innerGeometry.setAttribute('color', new THREE.BufferAttribute(innerColors, 3));
        innerGeometry.setAttribute('opacity', new THREE.BufferAttribute(innerOpacities, 1));
        
        // Créer les matériaux
        outerMaterial = createParticlesMaterial(false);  // Avec transparence pour le cercle extérieur
        innerMaterial = createParticlesMaterial(true);   // Sans transparence pour les cercles intérieurs
        
        // Créer les objets Points
        const outerParticlesObject = new THREE.Points(outerGeometry, outerMaterial);
        const innerParticlesObject = new THREE.Points(innerGeometry, innerMaterial);
        
        // Créer le groupe principal
        particlesGroup = new THREE.Group();
        
        // Créer le groupe pour le cercle extérieur
        outerCircleGroup = new THREE.Group();
        outerCircleGroup.add(outerParticlesObject);
        
        // Ajouter d'abord les particules extérieures (rendues en premier, donc derrière)
        particlesGroup.add(outerCircleGroup);
        
        // Ajouter ensuite les particules intérieures (rendues en dernier, donc devant)
        particlesGroup.add(innerParticlesObject);
        
        // Initialiser la rotation
        particlesGroup.rotation.x = THREE.MathUtils.degToRad(scrollConfig.startRotationX);
        scene.add(particlesGroup);
        
        // Désactiver les contrôles d'orbite
        controls.enabled = false;
        
        // Initialiser l'animation
        animate();
    } else {
        console.error("Canvas container not found");
    }
}

// Nouvelle fonction pour créer des géométries séparées
function createSeparateGeometries() {
    const outerParticles = particles.filter(p => !p.isInnerCircle && !p.isAdditionalCircle);
    const innerParticles = particles.filter(p => p.isInnerCircle || p.isAdditionalCircle);
    
    // Créer la géométrie pour le cercle extérieur
    const outerGeometry = new THREE.BufferGeometry();
    const outerPositions = new Float32Array(outerParticles.length * 3);
    const outerSizes = new Float32Array(outerParticles.length);
    const outerColors = new Float32Array(outerParticles.length * 3);
    const outerOpacities = new Float32Array(outerParticles.length);
    
    // Créer la géométrie pour les cercles intérieurs
    const innerGeometry = new THREE.BufferGeometry();
    const innerPositions = new Float32Array(innerParticles.length * 3);
    const innerSizes = new Float32Array(innerParticles.length);
    const innerColors = new Float32Array(innerParticles.length * 3);
    const innerOpacities = new Float32Array(innerParticles.length);
    
    // Initialiser les attributs
    outerGeometry.setAttribute('position', new THREE.BufferAttribute(outerPositions, 3));
    outerGeometry.setAttribute('size', new THREE.BufferAttribute(outerSizes, 1));
    outerGeometry.setAttribute('color', new THREE.BufferAttribute(outerColors, 3));
    outerGeometry.setAttribute('opacity', new THREE.BufferAttribute(outerOpacities, 1));
    
    innerGeometry.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
    innerGeometry.setAttribute('size', new THREE.BufferAttribute(innerSizes, 1));
    innerGeometry.setAttribute('color', new THREE.BufferAttribute(innerColors, 3));
    innerGeometry.setAttribute('opacity', new THREE.BufferAttribute(innerOpacities, 1));
    
    return { outerGeometry, innerGeometry };
}

// Fonction pour mettre à jour la position de la caméra en fonction du scroll
function updateCameraFromScroll() {
    const sections = document.querySelectorAll('.airdrop_content');
    if (sections.length < 3) return;
    
    const secondSection = sections[1];
    const thirdSection = sections[2];
    const secondSectionRect = secondSection.getBoundingClientRect();
    const thirdSectionRect = thirdSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Calculer la progression du scroll pour la section 2
    const section2Progress = Math.min(Math.max(0, 1 - (secondSectionRect.top / viewportHeight)), 1);
    
    // Section 2: Transition des particules extérieures
    if (section2Progress >= 0) {
        const startColor = new THREE.Color(0xffffff);
        const endColor = new THREE.Color(0x0C0E13);
        
        // Modifier la progression pour commencer à 50%
        const adjustedProgress = Math.max(0, (section2Progress - 0.5) * 2);
        
        // Utiliser une courbe plus douce pour la transition
        const smoothProgress = Math.pow(adjustedProgress, 0.5);
        
        // Interpoler la couleur
        const currentColor = startColor.clone().lerp(endColor, smoothProgress);
        
        // Calculer l'opacité
        // Commencer à diminuer l'opacité quand la couleur est proche de la couleur finale
        let opacity = 1.0;
        if (smoothProgress > 0.95) {
            // Mapper 0.95-1.0 à 1.0-0.0 pour l'opacité
            opacity = 1.0 - ((smoothProgress - 0.95) * 20); // 20 = 1/(1-0.95) pour normaliser
        }
        
        // Appliquer la couleur et l'opacité aux particules extérieures
        const colors = outerGeometry.attributes.color;
        const opacities = outerGeometry.attributes.opacity;
        
        for (let i = 0; i < colors.count; i++) {
            colors.setXYZ(i, currentColor.r, currentColor.g, currentColor.b);
            opacities.setX(i, opacity);
            
            // Mettre à jour également les propriétés des particules individuelles
            if (outerParticles[i]) {
                outerParticles[i].color = currentColor;
                outerParticles[i].opacity = opacity;
            }
        }
        
        colors.needsUpdate = true;
        opacities.needsUpdate = true;
    }
    
    // Calculer la progression pour la section 3
    const section3Progress = Math.min(Math.max(0, 1 - (thirdSectionRect.top / viewportHeight)), 1);
    
    // Calculer une progression d'opacité plus rapide (disparition plus tôt)
    const opacityProgress = Math.min(1, section3Progress * 1.5);
    
    // Transition de l'espacement vertical des cercles
    const startSpacing = 0.5;
    const endSpacing = 2.5;
    const currentSpacing = startSpacing + (endSpacing - startSpacing) * section3Progress;
    
    // Suivre les cercles uniques traités
    const processedIndices = new Set();
    
    // Mettre à jour l'opacité et la position des cercles
    innerParticles.forEach(particle => {
        if (particle.isInnerCircle) {
            particle.opacity = Math.max(0, 1 - opacityProgress);
            // Le cercle intérieur est maintenant à +2 espacements du centre
            particle.y = 2 * currentSpacing;
        }
        
        if (particle.isAdditionalCircle) {
            if (!processedIndices.has(particle.additionalCircleIndex)) {
                processedIndices.add(particle.additionalCircleIndex);
            }
            
            // Mettre à jour l'opacité des cercles blancs avec la progression accélérée
            if (particle.additionalCircleIndex !== 1) {
                particle.opacity = Math.max(0, 1 - opacityProgress);
            }
            
            // Mettre à jour la position Y avec un espacement uniforme
            if (particle.additionalCircleIndex === 1) {
                // Le cercle vert au centre
                particle.y = 0;
            } else if (particle.additionalCircleIndex === 0) {
                // Premier cercle blanc au-dessus du vert
                particle.y = currentSpacing;
            } else if (particle.additionalCircleIndex === 2) {
                // Premier cercle blanc en dessous du vert
                particle.y = -currentSpacing;
            } else if (particle.additionalCircleIndex === 3) {
                // Deuxième cercle blanc en dessous du vert
                particle.y = -2 * currentSpacing;
            }
        }
    });
    
    // Forcer la mise à jour des attributs de géométrie
    innerGeometry.attributes.position.needsUpdate = true;
    innerGeometry.attributes.opacity.needsUpdate = true;
    
    // Calculer la progression du scroll pour la rotation
    let rotationProgress = 1 - (secondSectionRect.top / viewportHeight);
    rotationProgress = Math.max(0, Math.min(1, rotationProgress));
    
    // Calculer la progression du scroll pour la division des cercles
    let splitProgress = 0;
    
    if (sections[2]) {
        const thirdSection = sections[2];
        const thirdSectionRect = thirdSection.getBoundingClientRect();
    if (thirdSectionRect.top <= viewportHeight) {
        splitProgress = 1 - (thirdSectionRect.top / viewportHeight);
        splitProgress = Math.max(0, Math.min(1, splitProgress));
        
        config.splitAnimation.active = true;
        config.splitAnimation.currentSizeMultiplier = 1.0 - (1.0 - config.splitAnimation.particleScale) * splitProgress;
        config.splitAnimation.otherCirclesOpacity = 1.0 - splitProgress;
    } else {
        config.splitAnimation.active = false;
        config.splitAnimation.currentSizeMultiplier = 1.0;
        config.splitAnimation.otherCirclesOpacity = 1.0;
        }
    }
    
    // Calculer la rotation X actuelle
    let currentRotationX;
    if (splitProgress > 0) {
        // Deuxième mouvement : compléter la rotation jusqu'à 180°
        const remainingRotation = 180 - (scrollConfig.startRotationX - scrollConfig.endRotationX);
        currentRotationX = scrollConfig.endRotationX - (remainingRotation * splitProgress);
        
        // Calculer la distance de la caméra
        const minDistance = scrollConfig.endDistance * 0.5; // Distance minimale (plus proche)
        
        // Calculer la progression du zoom basée uniquement sur la position de la section 2
        const section2Progress = Math.max(0, Math.min(1, 1 - (secondSectionRect.top / viewportHeight)));
        
        // Calculer la distance actuelle en fonction de la progression de la section 2
        const currentDistance = scrollConfig.startDistance + 
                              (scrollConfig.endDistance - scrollConfig.startDistance) * rotationProgress;
        
        // Appliquer le zoom supplémentaire uniquement pendant la section 2
        if (section2Progress < 1) {
            camera.position.z = currentDistance;
        } else {
            // Une fois la section 2 complètement visible, maintenir la distance finale
            camera.position.z = scrollConfig.endDistance;
        }
    } else {
        // Premier mouvement : de 90° à 11°
        currentRotationX = scrollConfig.startRotationX + 
                          (scrollConfig.endRotationX - scrollConfig.startRotationX) * rotationProgress;
    
        // Distance normale pendant la première étape
    const currentDistance = scrollConfig.startDistance + 
                          (scrollConfig.endDistance - scrollConfig.startDistance) * rotationProgress;
        camera.position.z = currentDistance;
    }
    
    // Convertir les degrés en radians et appliquer la rotation
    const angleInRadians = THREE.MathUtils.degToRad(currentRotationX);
    particlesGroup.rotation.x = angleInRadians;
    
    // Mettre à jour l'animation de division
    if (config.splitAnimation.active && splitProgress > 0) {
        updateSplitAnimation(splitProgress);
    } else if (!config.splitAnimation.active) {
        updateSplitAnimation(0);
    }
}

// Fonction pour mettre à jour l'animation de division
function updateSplitAnimation(progress) {
    // Identifier les particules du cercle central (index 1)
    const centralParticles = particles.filter(p => 
        p.isAdditionalCircle && 
        p.additionalCircleIndex === 1
    );
    
    // Si aucune particule ou progress invalide, ne rien faire
    if (centralParticles.length === 0 || progress < 0 || progress > 1) {
        return;
    }
    
    // Si l'animation est désactivée et progress est 0, restaurer les positions d'origine
    if (!config.splitAnimation.active && progress === 0) {
        centralParticles.forEach(particle => {
            if (particle.hasBeenSplit) {
                // Restaurer la position d'origine
                particle.x = particle.originalX;
                particle.y = particle.originalY;
                particle.z = particle.originalZ;
                
                // Restaurer les propriétés
                particle.isAdditionalCircle = true; // Toujours garder cette valeur à true
                particle.hasBeenSplit = false;
                particle.isStatic = true;
                particle.floatSpeed = 0.01 + Math.random() * 0.02;
                particle.floatPhase = Math.random() * Math.PI * 2;
                particle.isBorder = false; // Réinitialiser l'état de bordure
                
                // La taille est maintenant gérée par le multiplicateur global
                
                // Effacer les données d'animation mais maintenir l'activation
                particle.splitStartPosition = null;
                particle.splitTarget = null;
                particle.active = true;
            }
        });
        return;
    }
    
    // Calculer combien de particules par sous-cercle
    const gridSize = config.splitAnimation.gridSize;
    const totalSubCircles = gridSize * gridSize; // 9 sous-cercles
    const particlesPerSubCircle = Math.ceil(centralParticles.length / totalSubCircles);
    
    // Traiter chaque particule
    centralParticles.forEach((particle, index) => {
        // S'assurer que la particule reste active et visible
        particle.active = true;
        particle.isAdditionalCircle = true; // Toujours garder cette valeur à true
        
        // Marquer comme en cours de division
        particle.hasBeenSplit = true;
        
        // Déterminer à quel sous-cercle cette particule appartient
        const subCircleIndex = Math.floor(index / particlesPerSubCircle);
        const row = Math.floor(subCircleIndex / gridSize);
        const col = subCircleIndex % gridSize;
        
        // Sauvegarder la position d'origine si ce n'est pas déjà fait
        if (!particle.originalX) {
            particle.originalX = particle.x;
            particle.originalY = particle.y;
            particle.originalZ = particle.z;
        }
        
        // Sauvegarder la position de départ si nécessaire
        if (!particle.splitStartPosition) {
            particle.splitStartPosition = {
                x: particle.originalX,
                y: particle.originalY,
                z: particle.originalZ
            };
        }
        
        // Calculer la position cible si nécessaire
        if (!particle.splitTarget) {
            // Position du centre du sous-cercle dans la grille 3x3
            const centerX = (col - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            const centerZ = (row - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            
            // Déterminer si c'est une particule de bordure
            particle.isBorder = Math.random() < config.splitAnimation.borderParticleRatio;
            
            // Position dans le sous-cercle (distribution circulaire remplie)
            const particleIndexInSubCircle = index % particlesPerSubCircle;
            const angleInSubCircle = (particleIndexInSubCircle / particlesPerSubCircle) * Math.PI * 2;
            
            // Distribution radiale en fonction du type de particule (bordure ou non)
            let radiusFactor;
            if (particle.isBorder) {
                // Pour les particules de bordure, les placer près du bord du cercle
                radiusFactor = 0.8 + Math.random() * 0.4; // Entre 0.8 et 1.2 pour créer une bordure épaisse
            } else {
                // Pour les particules normales, utiliser la distribution habituelle
                radiusFactor = Math.pow(Math.random(), 0.5) * config.splitAnimation.circleFill;
            }
            const finalRadius = config.splitAnimation.circleRadius * radiusFactor;
            
            // Calculer la position finale avec une forme de cercle rempli
            particle.splitTarget = {
                x: centerX + Math.cos(angleInSubCircle) * finalRadius,
                z: centerZ + Math.sin(angleInSubCircle) * finalRadius
            };
            
            // Ajuster la taille en fonction du type de particule
            if (particle.isBorder) {
                particle.size *= config.splitAnimation.borderParticleScale;
            }
        }
        
        // Appliquer une courbe d'accélération pour une animation plus naturelle
        const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress  // Accélération plus forte au début
            : 1 - Math.pow(-2 * progress + 2, 3) / 2; // Décélération plus douce à la fin
        
        // Interpoler entre la position de départ et la position cible
        particle.x = particle.splitStartPosition.x * (1 - easeProgress) + particle.splitTarget.x * easeProgress;
        particle.z = particle.splitStartPosition.z * (1 - easeProgress) + particle.splitTarget.z * easeProgress;
        
        // La taille est maintenant gérée par le multiplicateur global dans la fonction animate
        
        // Ajuster progressivement les propriétés statiques
        if (progress > 0.95) {
            // Si l'animation est presque terminée, finaliser l'état
            particle.isStatic = true;
            particle.floatSpeed = particle.isBorder ? 0.02 + Math.random() * 0.03 : 0.01 + Math.random() * 0.02;
            particle.floatPhase = Math.random() * Math.PI * 2;
        } else {
            // Pendant l'animation, maintenir l'état adéquat
            particle.isStatic = false; // Non statique pendant l'animation pour permettre un mouvement fluide
        }
    });
}

// Classe pour gérer chaque particule
class Particle {
    constructor(index) {
        this.index = index;
        
        // Valeurs par défaut qui seront remplacées lors de la création
        this.isInnerCircle = false;
        this.isAdditionalCircle = false;
        this.additionalCircleIndex = -1;
        this.isStatic = false;
        this.hasBeenSplit = false;
        
        // Propriétés pour le flottement
        this.floatSpeed = 0;
        this.floatPhase = 0;
        
        // Nouvelles propriétés pour l'animation de division
        this.splitProgress = 0;
        this.splitTarget = null;
        this.splitStartPosition = null;
        this.splitEndPosition = null;
        
        // Propriétés pour la transition de taille
        this.sizeTransitionStart = 0;
        this.sizeTransitionTarget = 0;
        this.sizeTransitionProgress = 0;
        this.inSizeTransition = false;
        
        // Propriété d'opacité pour les cercles verticaux
        this.opacity = 1.0;

        this.active = true;
    }
    
    resetParticle() {
        if (this.isInnerCircle || this.isAdditionalCircle) {
            // Position aléatoire dans le cercle 
            const angle = Math.random() * Math.PI * 2;
            
            // Déterminer si c'est une particule de bordure
            const isBorder = Math.random() < (this.isAdditionalCircle ? config.additionalCircleBorderRatio : config.innerBorderParticleRatio);
            this.isBorder = isBorder;
            
            // Ajuster le rayon en fonction du type de particule
            let radiusFactor;
            if (isBorder) {
                // Pour les particules de bordure, les placer près du bord du cercle
                const borderWidth = this.isAdditionalCircle ? config.additionalCircleBorderWidth : config.innerBorderWidth;
                radiusFactor = 1.0 - borderWidth + Math.random() * (borderWidth * 2); // Distribuer autour du bord
            } else {
                // Pour les particules normales, utiliser la distribution habituelle
                radiusFactor = Math.pow(Math.random(), 0.5) * config.innerCircleFill;
            }
            
            this.radius = config.innerRadius * radiusFactor;
            this.isStatic = true;
            this.angle = angle;
            
            // Position horizontale (commune à tous les cercles)
            this.x = Math.cos(this.angle) * this.radius;
            this.z = Math.sin(this.angle) * this.radius;
            
            // Position verticale (spécifique à chaque cercle)
            if (this.isInnerCircle) {
                this.y = 2 * config.additionalCircleVerticalSpacing;
            } else if (this.isAdditionalCircle) {
                if (this.additionalCircleIndex === 1) {
                    // Le cercle vert au centre
                    this.y = 0;
                } else if (this.additionalCircleIndex === 0) {
                    // Premier cercle blanc au-dessus du vert
                    this.y = config.additionalCircleVerticalSpacing;
                } else {
                    // Les deux cercles blancs en dessous du vert
                    const offset = this.additionalCircleIndex - 1;
                    this.y = -offset * config.additionalCircleVerticalSpacing;
                }
            }
            
            // Taille des particules avec la nouvelle échelle
            if (this.isInnerCircle) {
                this.size = config.baseParticleSize * (isBorder ? config.additionalCircleBorderScale : (0.7 + Math.random() * 0.6));
            } else if (this.isAdditionalCircle) {
                const baseScale = this.additionalCircleIndex === 1 ? 
                    config.greenCircleParticleScale : 
                    config.whiteCircleParticleScale;
                this.size = config.baseParticleSize * (isBorder ? config.additionalCircleBorderScale : baseScale) * (0.7 + Math.random() * 0.6);
            }
            this.currentSize = this.size;
            
            // Pas de direction pour les particules statiques
            this.direction = 0;
            this.distanceTraveled = 0;
            
            // Réinitialiser les positions d'origine
            this.originalX = this.x;
            this.originalY = this.y;
            this.originalZ = this.z;

            // Initialiser le flottement pour les particules non divisées
            if (!this.hasBeenSplit) {
                this.floatSpeed = isBorder ? 0.02 + Math.random() * 0.03 : 0.01 + Math.random() * 0.02;
                this.floatPhase = Math.random() * Math.PI * 2;
            }
        } else {
            // Réinitialiser en tant que particule du cercle extérieur
            this.resetOuterParticle();
        }
    }
    
    // Méthode pour réinitialiser spécifiquement une particule du cercle extérieur
    resetOuterParticle() {
        const angle = Math.random() * Math.PI * 2;
        
        // Déterminer le type de particule
        const random = Math.random();
        const isInnerBorder = random < config.innerBorderParticleRatio;
        const isOuterBorder = !isInnerBorder && random < (config.innerBorderParticleRatio + config.outerBorderParticleRatio);
        const isMobile = !isInnerBorder && !isOuterBorder && !this.isStatic;
        
        // Définir le rayon et la taille en fonction du type
        if (isInnerBorder) {
            // Particules de la bordure intérieure
            const randomOffset = (Math.random() - 0.5) * config.innerBorderWidth;
            this.radius = config.outerRadius - config.innerBorderWidth/2 + randomOffset;
            this.size = config.outerCircleBorderParticleSize;
            this.isStatic = true;
        } else if (isOuterBorder) {
            // Particules de la bordure extérieure
            const randomOffset = (Math.random() - 0.5) * config.outerBorderWidth;
            this.radius = config.outerRadius + config.outerBorderWidth/2 + randomOffset;
            this.size = config.outerCircleBorderParticleSize;
            this.isStatic = true;
        } else if (isMobile) {
            // Particules mobiles
            this.radius = config.outerRadius;
            this.size = config.mobileParticleSize;
            this.isStatic = false;
        } else {
            // Particules statiques du cercle principal
            this.radius = config.outerRadius;
            this.size = config.outerCircleParticleSize;
            this.isStatic = true;
        }
        
        this.angle = angle;
        this.speed = config.particleSpeed * (0.8 + Math.random() * 0.4);
        this.direction = Math.random() < config.outerOutwardRatio ? 1 : -1;
        
        // Calculer la position directement
        this.x = Math.cos(this.angle) * this.radius;
        this.y = (Math.random() - 0.5) * 0.3;
        this.z = Math.sin(this.angle) * this.radius;
        
        this.distanceTraveled = 0;
        this.active = true;
        this.currentSize = this.size;

        if (!this.hasBeenSplit) {
            this.floatSpeed = 0.01 + Math.random() * 0.02;
            this.floatPhase = Math.random() * Math.PI * 2;
        }
    }
    
    update(deltaTime) {
        if (!this.active) return;

        // Cas spécial pour les particules du cercle central (index 1)
        if (this.isAdditionalCircle && this.additionalCircleIndex === 1) {
            return;
        }

        if (this.isStatic) {
            if (!this.hasBeenSplit) {
                this.floatPhase += this.floatSpeed;
                const float = Math.sin(this.floatPhase) * 0.15 + 1;
                this.currentSize = this.size * float;
            }
            return;
        }
        
        // Déplacement des particules du cercle extérieur uniquement
        this.distanceTraveled += this.speed * this.direction;
        
        // Si la particule a atteint sa distance maximale, la réinitialiser
        if (Math.abs(this.distanceTraveled) > config.maxParticleDistance) {
            this.resetOuterParticle();
            return;
        }
        
        // Calculer la nouvelle position radiale
        const currentRadius = this.radius + this.distanceTraveled;
        
        // Si la particule va vers l'intérieur et atteint le cercle intérieur, la réinitialiser
        if (this.direction < 0 && currentRadius <= config.innerRadius) {
            this.resetOuterParticle();
            return;
        }
        
        // Mettre à jour la position
        this.x = Math.cos(this.angle) * currentRadius;
        this.z = Math.sin(this.angle) * currentRadius;
        
        // Petite oscillation verticale pendant le mouvement
        this.y += (Math.random() - 0.5) * 0.01;
        this.y *= 0.98; // Amortissement pour éviter une trop grande dispersion
        
        // Calcul de la taille basé sur la distance parcourue
        const distanceRatio = Math.abs(this.distanceTraveled) / config.maxParticleDistance;
        const sizeFactor = Math.max(0, 1 - distanceRatio);
        
        // Appliquer une courbe quadratique pour une diminution plus naturelle
        this.currentSize = this.size * (sizeFactor * sizeFactor);
    }
}

// Créer la géométrie pour les particules
function createParticlesGeometry() {
    const totalParticles = config.innerCircleParticles + 
                         (config.additionalCircles * config.additionalCircleParticles) + 
                         config.outerCircleParticles;
    
    // Allocation des tableaux de données pour chaque particule
    const positions = new Float32Array(totalParticles * 3); // xyz pour chaque point
    const sizes = new Float32Array(totalParticles);
    const colors = new Float32Array(totalParticles * 3); // rgb pour chaque point
    const opacities = new Float32Array(totalParticles); // opacité pour chaque point
    
    // Initialiser avec des valeurs par défaut
    for (let i = 0; i < totalParticles; i++) {
        const idx = i * 3;
        // Position par défaut
        positions[idx] = 0;
        positions[idx + 1] = 0;
        positions[idx + 2] = 0;
        // Taille par défaut
        sizes[i] = config.baseParticleSize;
        // Couleur par défaut (va être remplacée dans la fonction animate)
        const color = new THREE.Color(config.particleColor);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
        // Opacité par défaut
        opacities[i] = 1.0;
    }
    
    // Préparation des couleurs de base pour utilisation dans l'animation
    const baseColor = {
        main: new THREE.Color(config.particleColor),
        split: new THREE.Color(config.splitCircleColor)
    };
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    
    return { geometry, positions, sizes, colors, opacities, baseColor };
}

// Créer le matériau pour les particules
function createParticlesMaterial(isOuterCircle = false) {
    return new THREE.ShaderMaterial({
        uniforms: {
            cameraPos: { value: camera.position }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float opacity;
            varying vec3 vColor;
            varying float vOpacity;
            uniform vec3 cameraPos;
            
            void main() {
                vColor = color;
                vOpacity = opacity;
                
                // Calcul de distance à la caméra
                float distanceToCamera = distance(position, cameraPos);
                
                // Ajustement de la taille en fonction de la profondeur
                float scaleFactor = 1.0 - (distanceToCamera * ${config.perspectiveEffect.toFixed(2)}) / 10.0;
                float adjustedSize = size * max(scaleFactor, 0.3);
                
                // Projection standard
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = adjustedSize * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vOpacity;
            
            void main() {
                // Calcul de la distance au centre du point
                vec2 center = vec2(0.5, 0.5);
                float dist = length(gl_PointCoord - center);
                
                // Réduire la taille du cercle visible
                float threshold = 0.25;
                
                // Création d'un point lumineux avec une transition nette
                float alpha = 1.0 - smoothstep(threshold, threshold + 0.01, dist);
                
                // Appliquer l'opacité de la particule avec une courbe plus agressive
                alpha *= pow(vOpacity, 1.5); // Utiliser une puissance > 1 pour une disparition plus rapide
                
                // Forcer les valeurs RGB exactes pour la couleur de fond
                vec3 finalColor = vColor;
                if(finalColor.r <= 0.05 && finalColor.g <= 0.06 && finalColor.b <= 0.08) {
                    finalColor = vec3(0.047, 0.055, 0.075); // Valeurs exactes pour 0x0C0E13
                    // Forcer une opacité nulle quand on atteint la couleur de fond
                    alpha = 0.0;
                }
                
                // Couleur finale
                gl_FragColor = vec4(finalColor, alpha);
                
                // Rejeter les fragments au-delà du seuil ou complètement transparents
                if (dist > threshold + 0.01 || alpha < 0.01) discard;
            }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: isOuterCircle,
        blending: THREE.NormalBlending
    });
}

// Créer un tableau de particules
function createParticles() {
    const particles = [];
    let index = 0;
    
    // Créer les particules pour le cercle intérieur
    for (let i = 0; i < config.innerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = true;
        particle.isAdditionalCircle = false;
        particle.additionalCircleIndex = -1;
        particle.isStatic = true;
        particle.resetParticle();
        particles.push(particle);
    }
    
    // Créer les particules pour les cercles supplémentaires
    for (let circleIndex = 0; circleIndex < config.additionalCircles; circleIndex++) {
        // Déterminer le nombre de particules et l'échelle en fonction du type de cercle
        const particleCount = circleIndex === 1 ? config.greenCircleParticles : config.whiteCircleParticles;
        const particleScale = circleIndex === 1 ? config.greenCircleParticleScale : config.whiteCircleParticleScale;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new Particle(index++);
            particle.isInnerCircle = false;
            particle.isAdditionalCircle = true;
            particle.additionalCircleIndex = circleIndex;
            particle.isStatic = true;
            particle.particleScale = particleScale;
            particle.resetParticle();
            particles.push(particle);
        }
    }
    
    // Créer les particules pour le cercle extérieur
    let staticCount = 0;
    let mobileCount = 0;
    const targetMobileRatio = 0.4;
    
    for (let i = 0; i < config.outerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = false;
        particle.isAdditionalCircle = false;
        particle.additionalCircleIndex = -1;
        
        const currentMobileRatio = mobileCount / (staticCount + mobileCount + 1);
        if (currentMobileRatio < targetMobileRatio) {
            particle.isStatic = false;
            mobileCount++;
        } else {
            particle.isStatic = Math.random() > targetMobileRatio;
            if (particle.isStatic) staticCount++;
            else mobileCount++;
        }
        
        particle.resetParticle();
        particles.push(particle);
    }
    
    return particles;
}

// Version alternative sans créer de cercles guides
function createGuideCircles() {
    // Créer un groupe vide (aucun cercle guide n'est créé)
    return new THREE.Group();
}

let guideCircles = createGuideCircles();
scene.add(guideCircles);

// Redimensionnement de la fenêtre
// Fonction pour ajuster la taille du renderer à celle du conteneur
function updateRendererSize() {
    const container = document.querySelector('.airdrop_left');
    if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    } else {
        // Fallback au cas où le conteneur n'est pas trouvé
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    }
}

window.addEventListener('resize', updateRendererSize);

// Fonction pour mettre à jour les indicateurs de caméra
function updateCameraInfo() {
    // Obtenir les éléments DOM pour les indicateurs
    const rotationXElement = document.getElementById('rotation-x');
    const rotationYElement = document.getElementById('rotation-y');
    const rotationZElement = document.getElementById('rotation-z');
    const distanceElement = document.getElementById('camera-distance');
    
    // Calculer la distance entre la caméra et le centre de la scène
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    
    // Obtenir les sections pour déterminer le progrès de défilement
    const sections = document.querySelectorAll('.airdrop_content');
    let scrollProgress = 0;
    
    if (sections.length >= 2) {
        const secondSection = sections[1];
        const secondSectionRect = secondSection.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Calculer la progression du scroll (0 à 1)
        scrollProgress = 1 - (secondSectionRect.top / viewportHeight);
        scrollProgress = Math.max(0, Math.min(1, scrollProgress));
    }
    
    // Interpolation linéaire simple entre les valeurs de début et de fin pour X
    const rotX = scrollConfig.startRotationX + 
                (scrollConfig.endRotationX - scrollConfig.startRotationX) * scrollProgress;
    
    // Mettre à jour les indicateurs avec des valeurs fixes pour Y et Z
    if (rotationXElement && rotationYElement && rotationZElement && distanceElement) {
        rotationXElement.textContent = rotX.toFixed(2);
        rotationYElement.textContent = "0.00";
        rotationZElement.textContent = "-180.00"; // Z reste constant
        distanceElement.textContent = distance.toFixed(2);
    }
}

// Fonction pour formater la taille en MB
function formatMemorySize(bytes) {
    return (bytes / 1024 / 1024).toFixed(2);
}

// Fonction pour mettre à jour les statistiques de performance
function updatePerformanceStats(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Mise à jour du compteur de frames
    frameCount++;
    fpsTime += deltaTime;
    
    // Mettre à jour les statistiques toutes les 500ms
    if (fpsTime >= fpsUpdateInterval) {
        const fps = Math.round((frameCount * 1000) / fpsTime);
        const frameTime = (fpsTime / frameCount).toFixed(2);
        const activeParticles = particles.filter(p => p.active).length;
        
        // Récupérer les éléments DOM
        const fpsElement = document.getElementById('fps-value');
        const frameTimeElement = document.getElementById('frame-time-value');
        const particlesElement = document.getElementById('particles-value');
        const memoryElement = document.getElementById('memory-value');
        
        // Vérifier si les éléments existent avant de mettre à jour
        if (fpsElement) {
            fpsElement.textContent = fps;
        }
        if (frameTimeElement) {
            frameTimeElement.textContent = `${frameTime} ms`;
        }
        if (particlesElement) {
            particlesElement.textContent = activeParticles;
        }
        
        // Afficher l'utilisation de la mémoire si disponible
        if (window.performance && window.performance.memory && memoryElement) {
            const memory = formatMemorySize(window.performance.memory.usedJSHeapSize);
            memoryElement.textContent = `${memory} MB`;
        }
        
        // Log pour le débogage
        console.log(`Performance Stats - FPS: ${fps}, Frame Time: ${frameTime}ms, Active Particles: ${activeParticles}`);
        
        // Réinitialiser les compteurs
        frameCount = 0;
        fpsTime = 0;
    }
}

function animate() {
    const currentTime = performance.now();
    requestAnimationFrame(animate);
    
    if (hasScrolled) {
        updateCameraFromScroll();
    } else {
        // Si on n'a pas encore scrollé, garder les particules blanches
        outerParticles.forEach((particle, i) => {
            const idx = i * 3;
            outerGeometry.attributes.color.array[idx] = 1;     // R = 1 (blanc)
            outerGeometry.attributes.color.array[idx + 1] = 1; // G = 1 (blanc)
            outerGeometry.attributes.color.array[idx + 2] = 1; // B = 1 (blanc)
        });
        outerGeometry.attributes.color.needsUpdate = true;
    }
    
    const mainColor = new THREE.Color(config.particleColor);
    const splitColor = new THREE.Color(config.splitCircleColor);
    
    let movingCount = 0;
    
    // Mettre à jour les particules intérieures
    innerParticles.forEach((particle, i) => {
        if (!particle.active) return;
        
        if (!particle.isStatic) {
            particle.update(0.016);
        }
        
        const idx = i * 3;
        innerGeometry.attributes.position.array[idx] = particle.x;
        innerGeometry.attributes.position.array[idx + 1] = particle.y;
        innerGeometry.attributes.position.array[idx + 2] = particle.z;
        
        innerGeometry.attributes.size.array[i] = particle.currentSize;
        
        // Gérer la couleur
        const color = particle.isAdditionalCircle && particle.additionalCircleIndex === 1 ? 
            splitColor : mainColor;
        innerGeometry.attributes.color.array[idx] = color.r;
        innerGeometry.attributes.color.array[idx + 1] = color.g;
        innerGeometry.attributes.color.array[idx + 2] = color.b;
        
        innerGeometry.attributes.opacity.array[i] = particle.opacity;
    });
    
    // Mettre à jour les particules extérieures
    outerParticles.forEach((particle, i) => {
        if (!particle.active) return;
        
        if (!particle.isStatic) {
            particle.update(0.016);
            movingCount++;
        }
        
        const idx = i * 3;
        outerGeometry.attributes.position.array[idx] = particle.x;
        outerGeometry.attributes.position.array[idx + 1] = particle.y;
        outerGeometry.attributes.position.array[idx + 2] = particle.z;
        
        outerGeometry.attributes.size.array[i] = particle.currentSize;
        
        // Appliquer l'opacité individuelle de la particule
        outerGeometry.attributes.opacity.array[i] = particle.opacity;
    });
    
    // Vérifier et réinitialiser les particules mobiles si nécessaire
    const minMobileParticles = Math.floor(config.outerCircleParticles * config.minMobileRatio);
    if (movingCount < minMobileParticles && frameCount % 10 === 0) {
        const particlesToConvert = Math.min(50, minMobileParticles - movingCount);
        let resetCount = 0;
        
        for (let i = 0; i < outerParticles.length && resetCount < particlesToConvert; i++) {
            const particle = outerParticles[i];
            if (particle.isStatic) {
                particle.isStatic = false;
                particle.direction = Math.random() < 0.7 ? -1 : 1;
                particle.speed = config.particleSpeed * (0.7 + Math.random() * 0.6);
                particle.distanceTraveled = 0;
                resetCount++;
            }
        }
    }
    
    // Mettre à jour les géométries
    innerGeometry.attributes.position.needsUpdate = true;
    innerGeometry.attributes.size.needsUpdate = true;
    innerGeometry.attributes.color.needsUpdate = true;
    innerGeometry.attributes.opacity.needsUpdate = true;
    
    outerGeometry.attributes.position.needsUpdate = true;
    outerGeometry.attributes.size.needsUpdate = true;
    outerGeometry.attributes.color.needsUpdate = true;
    outerGeometry.attributes.opacity.needsUpdate = true;
    
    renderer.render(scene, camera);
    
    // Ajouter le suivi des performances
    updatePerformanceStats(currentTime);
}

// Initialiser les contrôles UI après le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM chargé, initialisation...");
    
    // Mettre à jour la taille lors du chargement
    updateRendererSize();
    
    // Initialiser la scène
    init();
    
    // Ajouter un écouteur d'événement pour le défilement
    window.addEventListener('scroll', () => {
        // Marquer que l'utilisateur a commencé à défiler
        hasScrolled = true;
        // Mettre à jour la position de la caméra en fonction du défilement
        requestAnimationFrame(updateCameraFromScroll);
    });
    
    // Initialiser les contrôles
    setupControls();
    setupCameraInfoToggle();
});

// Gestion des contrôles UI
function setupControls() {
    const controlsPanel = document.getElementById('controls');
    const hideControlsBtn = document.getElementById('hideControls');
    let controlsVisible = true;

    // Configuration des contrôles
    const setupControl = (id, property, min, max, step) => {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(`${id}Value`);
        
        if (!slider || !valueDisplay) {
            console.error(`Contrôle non trouvé pour ${id}`);
            return;
        }
        
        // Initialiser avec la valeur actuelle
        slider.value = config[property];
        valueDisplay.textContent = config[property].toFixed(2);
        
        // Mettre à jour quand le slider change
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            config[property] = value;
            valueDisplay.textContent = value.toFixed(2);
            
            // Liste des propriétés qui nécessitent une recréation complète des particules
            const recreateProperties = [
                'innerCircleParticles',
                'outerCircleParticles',
                'whiteCircleParticles',
                'greenCircleParticles',
                'whiteCircleParticleScale',
                'greenCircleParticleScale'
            ];
            
            // Liste des propriétés qui nécessitent une réinitialisation des particules
            const resetProperties = [
                'innerRadius',
                'outerRadius',
                'additionalCircleVerticalSpacing',
                'staticRingWidth',
                'outerOutwardRatio',
                'innerCircleFill',
                'outerCircleParticleSize',
                'baseParticleSize',
                // Ajout des propriétés de bordure
                'additionalCircleBorderRatio',
                'additionalCircleBorderScale',
                'additionalCircleBorderWidth',
                'innerBorderParticleRatio',
                'outerBorderParticleRatio',
                'innerBorderWidth',
                'outerBorderWidth'
            ];
            
            console.log(`Modification de ${property} à ${value}`);
            
            // Si la propriété nécessite une recréation complète
            if (recreateProperties.includes(property)) {
                console.log(`Recréation des particules pour ${property}`);
                recreateParticles();
            }
            // Si la propriété nécessite une réinitialisation
            else if (resetProperties.includes(property)) {
                console.log(`Réinitialisation des particules pour ${property}`);
                particles.forEach(particle => {
                    particle.resetParticle();
                });
            }
            
            // Pour la perspective, recréer le matériau
            if (property === 'perspectiveEffect') {
                innerMaterial = createParticlesMaterial();
                outerMaterial = createParticlesMaterial();
                
                // Mettre à jour les matériaux des objets Points
                particlesGroup.children.forEach(points => {
                    if (points instanceof THREE.Points) {
                        points.material = points === innerParticlesObject ? innerMaterial : outerMaterial;
                    }
                });
            }
        });
    };

    // Fonction pour recréer le système de particules
    function recreateParticles() {
        console.log("Recréation des particules avec les nouveaux paramètres...");
        console.log("Nombre de particules vertes:", config.greenCircleParticles);
        console.log("Nombre de particules blanches:", config.whiteCircleParticles);
        
        // Créer les nouvelles particules
        particles = createParticles();
        
        // Séparer les particules en deux groupes
        outerParticles = particles.filter(p => !p.isInnerCircle && !p.isAdditionalCircle);
        innerParticles = particles.filter(p => p.isInnerCircle || p.isAdditionalCircle);
        
        // Supprimer les anciens groupes
        scene.remove(particlesGroup);
        
        // Créer les nouvelles géométries
        innerGeometry = new THREE.BufferGeometry();
        outerGeometry = new THREE.BufferGeometry();
        
        // Initialiser les attributs pour la géométrie intérieure
        const innerPositions = new Float32Array(innerParticles.length * 3);
        const innerSizes = new Float32Array(innerParticles.length);
        const innerColors = new Float32Array(innerParticles.length * 3);
        const innerOpacities = new Float32Array(innerParticles.length);
        
        // Initialiser les attributs pour la géométrie extérieure
        const outerPositions = new Float32Array(outerParticles.length * 3);
        const outerSizes = new Float32Array(outerParticles.length);
        const outerColors = new Float32Array(outerParticles.length * 3);
        const outerOpacities = new Float32Array(outerParticles.length);
        
        // Configurer les attributs des géométries
        innerGeometry.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
        innerGeometry.setAttribute('size', new THREE.BufferAttribute(innerSizes, 1));
        innerGeometry.setAttribute('color', new THREE.BufferAttribute(innerColors, 3));
        innerGeometry.setAttribute('opacity', new THREE.BufferAttribute(innerOpacities, 1));
        
        outerGeometry.setAttribute('position', new THREE.BufferAttribute(outerPositions, 3));
        outerGeometry.setAttribute('size', new THREE.BufferAttribute(outerSizes, 1));
        outerGeometry.setAttribute('color', new THREE.BufferAttribute(outerColors, 3));
        outerGeometry.setAttribute('opacity', new THREE.BufferAttribute(outerOpacities, 1));
        
        // Créer les matériaux
        innerMaterial = createParticlesMaterial(false); // Avec transparence pour les cercles intérieurs
        outerMaterial = createParticlesMaterial(true);  // Sans transparence pour le cercle extérieur
        
        // Créer les objets Points
        const innerParticlesObject = new THREE.Points(innerGeometry, innerMaterial);
        const outerParticlesObject = new THREE.Points(outerGeometry, outerMaterial);
        
        // Créer le groupe pour le cercle extérieur
        outerCircleGroup = new THREE.Group();
        outerCircleGroup.add(outerParticlesObject);
        
        // Créer le groupe principal
        particlesGroup = new THREE.Group();
        particlesGroup.add(outerCircleGroup);
        particlesGroup.add(innerParticlesObject);
        
        // Initialiser la rotation
        particlesGroup.rotation.x = THREE.MathUtils.degToRad(scrollConfig.startRotationX);
        scene.add(particlesGroup);
        
        // Forcer une mise à jour des attributs
        innerGeometry.attributes.position.needsUpdate = true;
        innerGeometry.attributes.size.needsUpdate = true;
        innerGeometry.attributes.color.needsUpdate = true;
        innerGeometry.attributes.opacity.needsUpdate = true;
        
        outerGeometry.attributes.position.needsUpdate = true;
        outerGeometry.attributes.size.needsUpdate = true;
        outerGeometry.attributes.color.needsUpdate = true;
        outerGeometry.attributes.opacity.needsUpdate = true;
    }

    // Gestion du bouton pour masquer/afficher les contrôles
    if (hideControlsBtn) {
        hideControlsBtn.addEventListener('click', () => {
            if (controlsVisible) {
                controlsPanel.style.right = '-270px';
                hideControlsBtn.textContent = 'Afficher';
            } else {
                controlsPanel.style.right = '10px';
                hideControlsBtn.textContent = 'Masquer';
            }
            controlsVisible = !controlsVisible;
        });
    }
    
    // Configuration des contrôles spécifiques
    setupControl('innerRadius', 'innerRadius', 0.5, 4, 0.1);
    setupControl('outerRadius', 'outerRadius', 3, 10, 0.1);
    setupControl('innerCircleParticles', 'innerCircleParticles', 100, 1000, 50);
    setupControl('outerCircleParticles', 'outerCircleParticles', 100, 2000, 50);
    setupControl('baseParticleSize', 'baseParticleSize', 0.1, 1, 0.05);
    setupControl('outerCircleParticleSize', 'outerCircleParticleSize', 0, 1, 0.05);
    setupControl('outerCircleBorderParticleSize', 'outerCircleBorderParticleSize', 0.1, 1, 0.05);
    setupControl('innerBorderWidth', 'innerBorderWidth', 0.1, 1, 0.05);
    setupControl('outerBorderWidth', 'outerBorderWidth', 0.1, 1, 0.05);
    setupControl('innerBorderParticleRatio', 'innerBorderParticleRatio', 0.05, 0.3, 0.05);
    setupControl('outerBorderParticleRatio', 'outerBorderParticleRatio', 0.05, 0.3, 0.05);
    setupControl('maxParticleDistance', 'maxParticleDistance', 0.5, 5, 0.1);
    setupControl('particleSpeed', 'particleSpeed', 0.005, 0.05, 0.001);
    setupControl('fadeWithDistance', 'fadeWithDistance', 0, 1, 0.05);
    setupControl('innerCircleFill', 'innerCircleFill', 0, 1, 0.05);
    setupControl('staticRingWidth', 'staticRingWidth', 0, 1, 0.05);
    setupControl('outerOutwardRatio', 'outerOutwardRatio', 0, 1, 0.05);
    setupControl('perspectiveEffect', 'perspectiveEffect', 0, 1, 0.05);
    setupControl('minMobileRatio', 'minMobileRatio', 0.1, 0.7, 0.05);
    setupControl('additionalCircleVerticalSpacing', 'additionalCircleVerticalSpacing', 0.2, 1.5, 0.1);
    
    // Contrôles pour les cercles additionnels
    setupControl('whiteCircleParticles', 'whiteCircleParticles', 100, 1000, 50);
    setupControl('greenCircleParticles', 'greenCircleParticles', 100, 1000, 50);
    setupControl('whiteCircleParticleScale', 'whiteCircleParticleScale', 0.1, 2.0, 0.1);
    setupControl('greenCircleParticleScale', 'greenCircleParticleScale', 0.1, 2.0, 0.1);
    
    // Nouveaux contrôles pour les bordures des cercles additionnels
    setupControl('additionalCircleBorderRatio', 'additionalCircleBorderRatio', 0.1, 0.5, 0.05);
    setupControl('additionalCircleBorderScale', 'additionalCircleBorderScale', 0.1, 1.0, 0.05);
    setupControl('additionalCircleBorderWidth', 'additionalCircleBorderWidth', 0.1, 0.5, 0.05);
}

// Gestion du bouton pour afficher/masquer les indicateurs de caméra
function setupCameraInfoToggle() {
    const cameraInfoPanel = document.getElementById('camera-info');
    const toggleButton = document.getElementById('toggleCameraInfo');
    let infoVisible = true;
    
    if (toggleButton && cameraInfoPanel) {
        toggleButton.addEventListener('click', () => {
            if (infoVisible) {
                const children = cameraInfoPanel.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i] !== toggleButton) {
                        children[i].style.display = 'none';
                    }
                }
                cameraInfoPanel.style.padding = '5px';
                toggleButton.textContent = 'Afficher';
            } else {
                const children = cameraInfoPanel.children;
                for (let i = 0; i < children.length; i++) {
                    children[i].style.display = '';
                }
                cameraInfoPanel.style.padding = '10px';
                toggleButton.textContent = 'Masquer';
            }
            infoVisible = !infoVisible;
        });
    }
}
