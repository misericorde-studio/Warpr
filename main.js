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
    outerCircleWidth: 0.5,      // Largeur du cercle extérieur principal
    outerCircleDensity: 0.4,    // Densité des particules du cercle extérieur
    
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
    greenCircleExtraParticles: 100, // Nouvelles particules pour l'animation de division
    whiteCircleParticleScale: 0.8, // Facteur d'échelle pour les particules des cercles blancs
    greenCircleParticleScale: 0.9, // Facteur d'échelle pour les particules du cercle vert
    additionalCircleVerticalSpacing: 0.15, // Espacement vertical initial entre les cercles
    
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
    
    // Calculer le pourcentage de progression global
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const globalProgress = (scrolled / scrollHeight) * 100;

    // Définir les seuils pour les différentes animations
    const outerCircleStartFade = 35;
    const outerCircleEndFade = 40;
    const verticalSpacingStart = 20;
    const verticalSpacingEnd = 60;
    const innerColorStart = 35;
    const innerColorEnd = 56;
    const splitStart = 65;
    const splitEnd = 95;
    
    // Calculer les progressions pour chaque animation
    const outerCircleProgress = Math.min(1, Math.max(0, (globalProgress - outerCircleStartFade) / (outerCircleEndFade - outerCircleStartFade)));
    const verticalSpacingProgress = Math.min(1, Math.max(0, (globalProgress - verticalSpacingStart) / (verticalSpacingEnd - verticalSpacingStart)));
    const innerColorProgress = Math.min(1, Math.max(0, (globalProgress - innerColorStart) / (innerColorEnd - innerColorStart)));
    const splitProgress = Math.min(1, Math.max(0, (globalProgress - splitStart) / (splitEnd - splitStart)));

    // Animation du cercle extérieur
    const startColor = new THREE.Color(0xffffff);
    const endColor = new THREE.Color(0x0C0E13);
    const smoothProgress = Math.pow(outerCircleProgress, 0.5);
        const currentColor = startColor.clone().lerp(endColor, smoothProgress);
        
        let opacity = 1.0;
        if (smoothProgress > 0.95) {
        opacity = 1.0 - ((smoothProgress - 0.95) * 20);
        }
        
        const colors = outerGeometry.attributes.color;
        const opacities = outerGeometry.attributes.opacity;
        
        for (let i = 0; i < colors.count; i++) {
            colors.setXYZ(i, currentColor.r, currentColor.g, currentColor.b);
            opacities.setX(i, opacity);
            
            if (outerParticles[i]) {
                outerParticles[i].color = currentColor;
                outerParticles[i].opacity = opacity;
            }
        }
        
        colors.needsUpdate = true;
        opacities.needsUpdate = true;

    // Animation de l'espacement vertical et de la couleur des cercles intérieurs
    const startSpacing = config.additionalCircleVerticalSpacing;
    const endSpacing = 1;
    const currentSpacing = startSpacing + (endSpacing - startSpacing) * verticalSpacingProgress;
    
    // Couleurs pour la transition
    const startColorSpacing = new THREE.Color(0xffffff);
    const endColorSpacing = new THREE.Color(0x0C0E13);
    
    // Suivre les cercles uniques traités
    const processedIndices = new Set();
    
    // Calculer le temps pour l'effet de flottement
    const time = Date.now() * 0.001;
    
    // Mettre à jour l'espacement et la couleur des cercles
    innerParticles.forEach(particle => {
        if (particle.isInnerCircle) {
            // Transition de couleur pour le cercle intérieur
            const currentColorSpacing = startColorSpacing.clone().lerp(endColorSpacing, innerColorProgress);
            particle.color = currentColorSpacing;
            particle.opacity = 1.0;
            particle.y = 2 * currentSpacing;
        }
        
        if (particle.isAdditionalCircle) {
            if (!processedIndices.has(particle.additionalCircleIndex)) {
                processedIndices.add(particle.additionalCircleIndex);
            }
            
            // Mettre à jour la couleur des cercles blancs
            if (particle.additionalCircleIndex !== 1) {
                const currentColorSpacing = startColorSpacing.clone().lerp(endColorSpacing, innerColorProgress);
                particle.color = currentColorSpacing;
                particle.opacity = 1.0;

                // Calculer l'effet de flottement pour les cercles blancs
                const verticalSpeed = 0.4 + (particle.additionalCircleIndex * 0.1);
                const horizontalSpeed = 0.2 + (particle.additionalCircleIndex * 0.1);
                const verticalAmplitude = 0.1;
                const horizontalAmplitude = 0.05;
                const individualOffset = particle.index * 0.5;

                const verticalOffset = Math.sin(time * verticalSpeed + individualOffset) * verticalAmplitude;
                const horizontalOffsetX = Math.cos(time * horizontalSpeed + individualOffset) * horizontalAmplitude;
                const horizontalOffsetZ = Math.sin(time * horizontalSpeed + individualOffset * 1.3) * horizontalAmplitude;

                // Mettre à jour la position Y avec un espacement uniforme
                let baseY;
                if (particle.additionalCircleIndex === 0) {
                    baseY = currentSpacing;
                } else if (particle.additionalCircleIndex === 2) {
                    baseY = -currentSpacing;
                } else if (particle.additionalCircleIndex === 3) {
                    baseY = -2 * currentSpacing;
                }

                // Appliquer les offsets de flottement
                particle.x = particle.originalX + horizontalOffsetX;
                particle.y = baseY + verticalOffset;
                particle.z = particle.originalZ + horizontalOffsetZ;
            } else {
                // Pour le cercle vert (index 1)
                particle.y = 0;
            }
        }
    });
    
    // Forcer la mise à jour des attributs de géométrie
    innerGeometry.attributes.position.needsUpdate = true;
    innerGeometry.attributes.color.needsUpdate = true;
    innerGeometry.attributes.opacity.needsUpdate = true;
    
    // Animation de la rotation du contenu
    // Rotation continue de 90° à -90° sur toute la durée du scroll
    const currentRotationX = 90 - (180 * (globalProgress / 100));
    particlesGroup.rotation.x = THREE.MathUtils.degToRad(currentRotationX);

    // Animation de la distance de la caméra (de 0% à 40%)
    const cameraProgress = Math.min(1, globalProgress / outerCircleEndFade);
    const currentDistance = scrollConfig.startDistance - 
                          ((scrollConfig.startDistance - scrollConfig.endDistance) * cameraProgress);
    camera.position.z = currentDistance;

    // Animation de division
    if (splitProgress > 0) {
        config.splitAnimation.active = true;
        config.splitAnimation.currentSizeMultiplier = 1.0;
        config.splitAnimation.otherCirclesOpacity = 1.0 - splitProgress;
        updateSplitAnimation(splitProgress);
    } else {
        config.splitAnimation.active = false;
        config.splitAnimation.currentSizeMultiplier = 1.0;
        config.splitAnimation.otherCirclesOpacity = 1.0;
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
    
    // Calculer combien de particules par sous-cercle
    const gridSize = config.splitAnimation.gridSize;
    const totalSubCircles = gridSize * gridSize;
    const particlesPerSubCircle = Math.ceil(centralParticles.length / totalSubCircles);
    
    // Traiter chaque particule
    centralParticles.forEach((particle, index) => {
        // S'assurer que la particule reste active
        particle.active = true;
        particle.opacity = 1.0;
        
        // Gérer la taille des particules supplémentaires
        if (particle.isExtraGreenParticle) {
            particle.currentSize = particle.size * progress;
        } else {
            particle.currentSize = particle.size;
        }
        
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
            const subCircleIndex = Math.floor(index / particlesPerSubCircle);
            const row = Math.floor(subCircleIndex / gridSize);
            const col = subCircleIndex % gridSize;
            
            const centerX = (col - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            const centerZ = (row - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            
            // Déterminer si c'est une particule de bordure
            particle.isBorder = Math.random() < config.splitAnimation.borderParticleRatio;
            
            // Position dans le sous-cercle
            const particleIndexInSubCircle = index % particlesPerSubCircle;
            const angleInSubCircle = (particleIndexInSubCircle / particlesPerSubCircle) * Math.PI * 2;
            
            // Distribution radiale
            let radiusFactor;
            if (particle.isBorder) {
                radiusFactor = 0.8 + Math.random() * 0.4;
            } else {
                radiusFactor = Math.pow(Math.random(), 0.5) * config.splitAnimation.circleFill;
            }
            const finalRadius = config.splitAnimation.circleRadius * radiusFactor;
            
            particle.splitTarget = {
                x: centerX + Math.cos(angleInSubCircle) * finalRadius,
                z: centerZ + Math.sin(angleInSubCircle) * finalRadius,
                y: particle.y // Conserver la position Y d'origine
            };
        }
        
        // Appliquer une courbe d'accélération pour une animation plus naturelle
        const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Calculer l'effet de flottement
        const time = Date.now() * 0.001;
        const individualOffset = index * 0.5;
        const verticalSpeed = 0.8;
        const horizontalSpeed = 0.4;
        const verticalAmplitude = 0.15;
        const horizontalAmplitude = 0.1;
        
        // Calculer les offsets de flottement avec une courbe plus prononcée
        const verticalOffset = Math.sin(time * verticalSpeed + individualOffset) * verticalAmplitude;
        const horizontalOffsetX = Math.cos(time * horizontalSpeed + individualOffset) * horizontalAmplitude;
        const horizontalOffsetZ = Math.sin(time * horizontalSpeed + individualOffset * 1.3) * horizontalAmplitude;

        // Interpoler entre la position de départ et la position cible
        const baseX = particle.splitStartPosition.x * (1 - easeProgress) + particle.splitTarget.x * easeProgress;
        const baseZ = particle.splitStartPosition.z * (1 - easeProgress) + particle.splitTarget.z * easeProgress;

        // Appliquer le flottement progressivement avec l'animation
        // Utiliser une courbe plus prononcée pour le progrès du flottement
        const floatProgress = Math.pow(progress, 0.7); // Rend le flottement plus visible plus tôt
        particle.x = baseX + horizontalOffsetX * floatProgress;
        particle.y = particle.splitStartPosition.y + verticalOffset * floatProgress;
        particle.z = baseZ + horizontalOffsetZ * floatProgress;
        
        // Marquer la particule comme étant en cours de division
        particle.hasBeenSplit = true;
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
        
        // Ne pas réinitialiser la taille si c'est une particule supplémentaire
        if (!this.isExtraGreenParticle) {
            this.currentSize = this.size;
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
            const randomOffset = (Math.random() - 0.5) * config.outerCircleWidth;
            this.radius = config.outerRadius + randomOffset;
            this.size = config.outerCircleParticleSize;
            this.isStatic = Math.random() > config.outerCircleDensity;
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
        const particleCount = circleIndex === 1 ? 
            (config.greenCircleParticles + config.greenCircleExtraParticles) : 
            config.whiteCircleParticles;
        const particleScale = circleIndex === 1 ? config.greenCircleParticleScale : config.whiteCircleParticleScale;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new Particle(index++);
            particle.isInnerCircle = false;
            particle.isAdditionalCircle = true;
            particle.additionalCircleIndex = circleIndex;
            particle.isStatic = true;
            particle.particleScale = particleScale;
            
            // Marquer les particules supplémentaires du cercle vert
            if (circleIndex === 1 && i >= config.greenCircleParticles) {
                particle.isExtraGreenParticle = true;
                particle.size = config.baseParticleSize * particleScale;
                particle.currentSize = 0; // Taille initiale à 0
                particle.opacity = 1;
            }
            
            // Important : resetParticle() après avoir défini toutes les propriétés
            particle.resetParticle();
            
            // S'assurer que la taille reste à 0 pour les particules supplémentaires après le reset
            if (particle.isExtraGreenParticle) {
                particle.currentSize = 0;
            }
            
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
    
    // Calculer le temps pour l'effet de flottement
    const time = Date.now() * 0.001;
    
    // Mettre à jour les particules intérieures
    innerParticles.forEach((particle, i) => {
        if (!particle.active) return;
        
        if (!particle.isStatic) {
            particle.update(0.016);
        }

        const idx = i * 3;

        // Appliquer un léger flottement vertical pour les cercles blancs
        if (particle.isAdditionalCircle && particle.additionalCircleIndex !== 1) {
            // S'assurer que chaque particule a une phase initiale
            if (particle.floatPhase === undefined) {
                particle.floatPhase = Math.random() * Math.PI * 2;
            }
            
            // Créer un mouvement vertical très léger et unique pour chaque particule
            const verticalOffset = Math.sin(time * 0.5 + particle.floatPhase) * 0.03;

            // Appliquer uniquement l'offset vertical
            innerGeometry.attributes.position.array[idx] = particle.x;
            innerGeometry.attributes.position.array[idx + 1] = particle.y + verticalOffset;
            innerGeometry.attributes.position.array[idx + 2] = particle.z;
        } else {
            // Pour les autres particules, utiliser leur position normale
            innerGeometry.attributes.position.array[idx] = particle.x;
            innerGeometry.attributes.position.array[idx + 1] = particle.y;
            innerGeometry.attributes.position.array[idx + 2] = particle.z;
        }
        
        innerGeometry.attributes.size.array[i] = particle.currentSize;
        
        // Gérer la couleur
        const color = particle.isAdditionalCircle && particle.additionalCircleIndex === 1 ? 
            splitColor : (particle.color || mainColor);
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

    // Initialisation des sections
    const sections = document.querySelectorAll('.section-content');
    sections.forEach(section => {
        section.style.maxHeight = section.scrollHeight + "px";
    });

    // Gestion des sections
    document.querySelectorAll('.section-header').forEach(header => {
        const button = header.querySelector('.toggle-section');
        const content = header.nextElementSibling;
        
        // S'assurer que les sections sont initialement visibles
        button.classList.remove('collapsed');
        content.classList.remove('collapsed');
        
        header.addEventListener('click', () => {
            button.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
    });

    // Gestion du bouton pour masquer/afficher les contrôles
    const hideButton = document.getElementById('hideControls');
    const controls = document.getElementById('controls');
    let isHidden = false;

    hideButton.addEventListener('click', () => {
        isHidden = !isHidden;
        controls.style.transform = isHidden ? 'translateX(-100%)' : 'translateX(0)';
        hideButton.textContent = isHidden ? 'Show' : 'Hide';
    });
});

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

function setupControls() {
    // Gestion des sections
    document.querySelectorAll('.section-header').forEach(header => {
        const button = header.querySelector('.toggle-section');
        const content = header.nextElementSibling;
        
        // S'assurer que les sections sont initialement visibles
        button.classList.remove('collapsed');
        content.classList.remove('collapsed');
        
        header.addEventListener('click', () => {
            button.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
    });

    // Gestion du bouton pour masquer/afficher les contrôles
    const hideButton = document.getElementById('hideControls');
    const controls = document.getElementById('controls');
    let isHidden = false;

    hideButton.addEventListener('click', () => {
        isHidden = !isHidden;
        controls.style.transform = isHidden ? 'translateX(-100%)' : 'translateX(0)';
        hideButton.textContent = isHidden ? 'Show' : 'Hide';
    });

    // Gestion de la visibilité des éléments
    const showOuterCircle = document.getElementById('showOuterCircle');
    const showBorders = document.getElementById('showBorders');
    const showMobileParticles = document.getElementById('showMobileParticles');

    if (showOuterCircle && showBorders && showMobileParticles) {
        const updateVisibility = () => {
                particles.forEach(particle => {
                // Réinitialiser l'état actif
                particle.active = true;

                // Gérer la visibilité du cercle extérieur (seulement les particules statiques)
                if (!showOuterCircle.checked && !particle.isInnerCircle && !particle.isAdditionalCircle && particle.isStatic) {
                    particle.active = false;
                }

                // Gérer la visibilité des bordures
                if (!showBorders.checked && particle.isBorder) {
                    particle.active = false;
                }

                // Gérer la visibilité des particules mobiles (uniquement celles qui ne sont pas statiques)
                if (!showMobileParticles.checked && !particle.isStatic) {
                    particle.active = false;
            }
        });
    };

        // Appliquer la visibilité initiale
        updateVisibility();

        // Ajouter les écouteurs d'événements
        showOuterCircle.addEventListener('change', updateVisibility);
        showBorders.addEventListener('change', updateVisibility);
        showMobileParticles.addEventListener('change', updateVisibility);
    }

    // Configuration des contrôles spécifiques
    // Cercle extérieur
    const outerRadiusControl = document.getElementById('outerRadius');
    const outerCircleParticlesControl = document.getElementById('outerCircleParticles');
    const outerCircleParticleSizeControl = document.getElementById('outerCircleParticleSize');
    const outerCircleWidthControl = document.getElementById('outerCircleWidth');
    const outerCircleDensityControl = document.getElementById('outerCircleDensity');

    // Bordures
    const innerBorderWidthControl = document.getElementById('innerBorderWidth');
    const outerBorderWidthControl = document.getElementById('outerBorderWidth');
    const outerCircleBorderParticleSizeControl = document.getElementById('outerCircleBorderParticleSize');
    const innerBorderParticleRatioControl = document.getElementById('innerBorderParticleRatio');
    const outerBorderParticleRatioControl = document.getElementById('outerBorderParticleRatio');

    // Particules mobiles
    const maxParticleDistanceControl = document.getElementById('maxParticleDistance');
    const particleSpeedControl = document.getElementById('particleSpeed');
    const minMobileRatioControl = document.getElementById('minMobileRatio');
    const outerOutwardRatioControl = document.getElementById('outerOutwardRatio');
    const fadeWithDistanceControl = document.getElementById('fadeWithDistance');

    // Cercles verticaux
    const innerRadiusControl = document.getElementById('innerRadius');
    const whiteCircleParticlesControl = document.getElementById('whiteCircleParticles');
    const greenCircleParticlesControl = document.getElementById('greenCircleParticles');
    const whiteCircleParticleScaleControl = document.getElementById('whiteCircleParticleScale');
    const greenCircleParticleScaleControl = document.getElementById('greenCircleParticleScale');
    const additionalCircleVerticalSpacingControl = document.getElementById('additionalCircleVerticalSpacing');

    // Cercles de fin
    const splitCircleSpacingControl = document.getElementById('splitCircleSpacing');
    const splitCircleRadiusControl = document.getElementById('splitCircleRadius');
    const splitCircleFillControl = document.getElementById('splitCircleFill');
    const splitParticleScaleControl = document.getElementById('splitParticleScale');
    const splitBorderParticleRatioControl = document.getElementById('splitBorderParticleRatio');
    const splitBorderParticleScaleControl = document.getElementById('splitBorderParticleScale');

    // Cercle extérieur
    outerRadiusControl.value = config.outerRadius.toFixed(2);
    outerCircleParticlesControl.value = config.outerCircleParticles.toString();
    outerCircleParticleSizeControl.value = config.outerCircleParticleSize.toFixed(2);
    outerCircleWidthControl.value = config.outerCircleWidth.toFixed(2);
    outerCircleDensityControl.value = config.outerCircleDensity.toFixed(2);

    // Bordures
    innerBorderWidthControl.value = config.innerBorderWidth.toFixed(2);
    outerBorderWidthControl.value = config.outerBorderWidth.toFixed(2);
    outerCircleBorderParticleSizeControl.value = config.outerCircleBorderParticleSize.toFixed(2);
    innerBorderParticleRatioControl.value = config.innerBorderParticleRatio.toFixed(2);
    outerBorderParticleRatioControl.value = config.outerBorderParticleRatio.toFixed(2);

    // Particules mobiles
    maxParticleDistanceControl.value = config.maxParticleDistance.toFixed(2);
    particleSpeedControl.value = config.particleSpeed.toFixed(2);
    minMobileRatioControl.value = config.minMobileRatio.toFixed(2);
    outerOutwardRatioControl.value = config.outerOutwardRatio.toFixed(2);
    fadeWithDistanceControl.value = config.fadeWithDistance.toFixed(2);

    // Cercles verticaux
    innerRadiusControl.value = config.innerRadius.toFixed(2);
    whiteCircleParticlesControl.value = config.whiteCircleParticles.toString();
    greenCircleParticlesControl.value = config.greenCircleParticles.toString();
    whiteCircleParticleScaleControl.value = config.whiteCircleParticleScale.toFixed(2);
    greenCircleParticleScaleControl.value = config.greenCircleParticleScale.toFixed(2);
    additionalCircleVerticalSpacingControl.value = config.additionalCircleVerticalSpacing.toFixed(2);

    // Cercles de fin
    splitCircleSpacingControl.value = config.splitAnimation.spacing.toFixed(2);
    splitCircleRadiusControl.value = config.splitAnimation.circleRadius.toFixed(2);
    splitCircleFillControl.value = config.splitAnimation.circleFill.toFixed(2);
    splitParticleScaleControl.value = config.splitAnimation.particleScale.toFixed(2);
    splitBorderParticleRatioControl.value = config.splitAnimation.borderParticleRatio.toFixed(2);
    splitBorderParticleScaleControl.value = config.splitAnimation.borderParticleScale.toFixed(2);

    // Mettre à jour les contrôles
    function updateControl(control, property) {
        const value = parseFloat(control.value);
        config[property] = value;
        
        // Liste des propriétés qui nécessitent une recréation complète des particules
        const recreateProperties = [
            'outerCircleParticles',
            'whiteCircleParticles',
            'greenCircleParticles'
        ];
        
        // Liste des propriétés qui nécessitent une réinitialisation des particules
        const resetProperties = [
            'innerRadius',
            'outerRadius',
            'additionalCircleVerticalSpacing',
            'outerCircleParticleSize',
            'outerCircleBorderParticleSize',
            'innerBorderWidth',
            'outerBorderWidth',
            'outerCircleWidth',
            'outerCircleDensity',
            'innerBorderParticleRatio',
            'outerBorderParticleRatio'
        ];
        
        // Si la propriété nécessite une recréation complète
        if (recreateProperties.includes(property)) {
            recreateParticles();
        }
        // Si la propriété nécessite une réinitialisation
        else if (resetProperties.includes(property)) {
            particles.forEach(particle => {
                particle.resetParticle();
            });
        }
    }

    outerRadiusControl.addEventListener('input', () => updateControl(outerRadiusControl, 'outerRadius'));
    outerCircleParticlesControl.addEventListener('input', () => updateControl(outerCircleParticlesControl, 'outerCircleParticles'));
    outerCircleParticleSizeControl.addEventListener('input', () => updateControl(outerCircleParticleSizeControl, 'outerCircleParticleSize'));
    outerCircleWidthControl.addEventListener('input', () => updateControl(outerCircleWidthControl, 'outerCircleWidth'));
    outerCircleDensityControl.addEventListener('input', () => updateControl(outerCircleDensityControl, 'outerCircleDensity'));

    innerBorderWidthControl.addEventListener('input', () => updateControl(innerBorderWidthControl, 'innerBorderWidth'));
    outerBorderWidthControl.addEventListener('input', () => updateControl(outerBorderWidthControl, 'outerBorderWidth'));
    outerCircleBorderParticleSizeControl.addEventListener('input', () => updateControl(outerCircleBorderParticleSizeControl, 'outerCircleBorderParticleSize'));
    innerBorderParticleRatioControl.addEventListener('input', () => updateControl(innerBorderParticleRatioControl, 'innerBorderParticleRatio'));
    outerBorderParticleRatioControl.addEventListener('input', () => updateControl(outerBorderParticleRatioControl, 'outerBorderParticleRatio'));

    maxParticleDistanceControl.addEventListener('input', () => updateControl(maxParticleDistanceControl, 'maxParticleDistance'));
    particleSpeedControl.addEventListener('input', () => updateControl(particleSpeedControl, 'particleSpeed'));
    minMobileRatioControl.addEventListener('input', () => updateControl(minMobileRatioControl, 'minMobileRatio'));
    outerOutwardRatioControl.addEventListener('input', () => updateControl(outerOutwardRatioControl, 'outerOutwardRatio'));
    fadeWithDistanceControl.addEventListener('input', () => updateControl(fadeWithDistanceControl, 'fadeWithDistance'));

    innerRadiusControl.addEventListener('input', () => updateControl(innerRadiusControl, 'innerRadius'));
    whiteCircleParticlesControl.addEventListener('input', () => updateControl(whiteCircleParticlesControl, 'whiteCircleParticles'));
    greenCircleParticlesControl.addEventListener('input', () => updateControl(greenCircleParticlesControl, 'greenCircleParticles'));
    whiteCircleParticleScaleControl.addEventListener('input', () => updateControl(whiteCircleParticleScaleControl, 'whiteCircleParticleScale'));
    greenCircleParticleScaleControl.addEventListener('input', () => updateControl(greenCircleParticleScaleControl, 'greenCircleParticleScale'));
    additionalCircleVerticalSpacingControl.addEventListener('input', () => updateControl(additionalCircleVerticalSpacingControl, 'additionalCircleVerticalSpacing'));

    splitCircleSpacingControl.addEventListener('input', () => updateControl(splitCircleSpacingControl, 'splitAnimation.spacing'));
    splitCircleRadiusControl.addEventListener('input', () => updateControl(splitCircleRadiusControl, 'splitAnimation.circleRadius'));
    splitCircleFillControl.addEventListener('input', () => updateControl(splitCircleFillControl, 'splitAnimation.circleFill'));
    splitParticleScaleControl.addEventListener('input', () => updateControl(splitParticleScaleControl, 'splitAnimation.particleScale'));
    splitBorderParticleRatioControl.addEventListener('input', () => updateControl(splitBorderParticleRatioControl, 'splitAnimation.borderParticleRatio'));
    splitBorderParticleScaleControl.addEventListener('input', () => updateControl(splitBorderParticleScaleControl, 'splitAnimation.borderParticleScale'));
}

// Appeler setupControls après l'initialisation de Three.js
setupControls();
