import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const config = {
    radius: 1.5,
    particleCount: 2600,
    particleSize: 8.40,
    curveAmplitude: 0.4,
    curveFrequency: 9,
    curvePhases: 4,
    noiseScale: 0.8,
    noisePower: 1.2,
    backgroundColor: 0x0B0E13,
    particleColor: 0x00FEA5,
    particleGlowIntensity: 1.0,
    particleGlowRadius: 0.25,
    particleGlowColor: 0x4FFFC1,
    cameraDistance: -3,
    initialZoom: 1.6,
    finalZoom: 0.8,
    cameraNear: 1,
    cameraFar: 2.2,
    initialFar: 2.2,
    finalFar: 4.5,
    greenThreshold: 0.01,  // Retour à la valeur initiale originale
    // Configuration de la bordure
    borderWidth: 0.4,        // Largeur de la bordure
    borderParticleCount: 2000, // Nombre de particules dans la bordure
    borderParticleMaxSize: 4.20,  // Modifié de 12.0 à 4.20
    borderParticleMinSize: 4.20,  // Modifié de 4.0 à 4.20 pour une taille uniforme
    borderColor: 0xFFFFFF,    // Couleur de la bordure
    thicknessVariationMultiplier: 5.0, // Augmenté de 3.0 à 5.0 pour plus de variation d'épaisseur
};

// Variables globales
let scene, camera, renderer, controls;
let particles, borderParticles;
let clock;
let container;
let heightVariation = 0.22;
let lineThickness = 0.030;
let lastScrollY = 0;
let lastFrameTime = 0;
let thresholdContainer, thresholdLine; // Cache pour les éléments DOM fréquemment utilisés
let particleShader, borderShader; // Cache pour les shaders
let isScrolling = false;
let scrollTimeout;

// Tableaux de positions
let mainInitialPositions;
let mainFinalPositions;
let positions;

// Tableaux de phases
let phaseOffsets = [0, Math.PI/2, Math.PI, Math.PI*3/2];
let frequencyMultipliers = [1, 0.5, 0.7, 0.3];
let amplitudeMultipliers = [1, 0.8, 0.6, 0.4];

// Fonction de bruit 1D simplifiée
function noise1D(x) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const fadeX = x * x * (3 - 2 * x);
    
    // Utilisation de fonctions trigonométriques pour générer des valeurs pseudo-aléatoires
    const h1 = Math.sin(X * 12.9898) * 43758.5453123;
    const h2 = Math.sin((X + 1) * 12.9898) * 43758.5453123;
    
    return lerp(h1 - Math.floor(h1), h2 - Math.floor(h2), fadeX);
}

// Interpolation linéaire
function lerp(a, b, t) {
    return a + t * (b - a);
}

// Initialisation
function init() {
    // Récupération du conteneur
    container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    
    // Scène principale
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);

    // Caméra orthographique
    const aspect = container.clientWidth / container.clientHeight;
    const baseWidth = 1920; // Largeur de référence
    const frustumSize = (baseWidth / container.clientWidth) * 3.5;
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        config.cameraNear,
        config.cameraFar
    );

    // Positionnement initial de la caméra
    camera.position.set(0, 0, config.cameraDistance);
    camera.lookAt(0, 0, 0);
    camera.zoom = config.initialZoom;
    camera.updateProjectionMatrix();

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    
    // Horloge
    clock = new THREE.Clock();

    // Création des particules
    createParticles();
    
    // Centrer les particules dans la scène
    if (particles) {
        particles.position.set(0, 0, 0);
    }

    // Mise en cache des éléments DOM
    cacheElements();

    // Événements
    window.addEventListener('resize', throttle(onWindowResize, 100), false);
    window.addEventListener('scroll', throttle(updateScroll, 16), { passive: true }); // Optimisation avec passive: true
    
    // Utilisation de scroll events optimisés
    window.addEventListener('scroll', function() {
        if (!isScrolling) {
            isScrolling = true;
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
            isScrolling = false;
        }, 150);
    }, { passive: true });

    // Ajout de l'initialisation des contrôles
    setupControls();

    // Animation avec timestamp
    lastFrameTime = performance.now();
    animate(lastFrameTime);
}

// Animation optimisée
function animate(timestamp) {
    requestAnimationFrame(animate);
    
    // Limiter le framerate à ~60fps
    if (timestamp - lastFrameTime < 16) {
        return;
    }
    lastFrameTime = timestamp;
    
    // Rendu de la scène principale
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.setClearColor(config.backgroundColor);
    renderer.render(scene, camera);
}

// Création des particules
function createParticles() {
    // Création des particules principales
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const colors = new Float32Array(config.particleCount * 3);
    const mainInitialPositions = new Float32Array(config.particleCount * 3);
    const mainFinalPositions = new Float32Array(config.particleCount * 3);
    const radialOffsets = new Float32Array(config.particleCount); // Nouvel attribut pour les offsets radiaux

    // Valeurs fixes pour la continuité
    const startValues = new Float32Array(config.curvePhases);
    const endValues = new Float32Array(config.curvePhases);
    for (let phase = 0; phase < config.curvePhases; phase++) {
        startValues[phase] = Math.sin(0 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]);
        endValues[phase] = Math.sin(Math.PI * 2 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]);
    }

    // Trouver la hauteur maximale et minimale
    let maxY = -Infinity;
    let minY = Infinity;

    // Premier passage pour trouver les valeurs min/max de Y
    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.particleCount) * Math.PI * 2;
        const progress = i / (config.particleCount - 1);

        // Réduction de la variation d'angle pour une distribution plus régulière
        const angleVariation = (Math.random() - 0.5) * 0.02;
        const finalAngle = angle + angleVariation;
        
        // Distribution radiale plus régulière avec variation minimale
        const randomFactor = 0.8 + Math.random() * 0.4; // Entre 0.8 et 1.2
        const layerOffset = (randomFactor - 1) * 0.04; // Variation réduite
        
        // État initial : toutes les particules presque sur le cercle de base
        const initialRadius = config.radius * (1 + layerOffset * 0.2);
        
        // État final : variation radiale légèrement plus prononcée
        const finalRadius = config.radius * (1 + layerOffset);

        // Positions initiales (quasi-régulières sur le cercle)
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;

        // Positions finales (légèrement plus variées)
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;

        // Calcul de la hauteur Y avec distribution contrôlée
        const thicknessVariation = (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.6);
        const baseThickness = lineThickness * (1 + thicknessVariation);
        const randomY = (Math.random() * 2 - 1) * baseThickness;
        let y = randomY;
        
        // Ajout des variations de hauteur de manière plus régulière
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            let value = Math.sin(finalAngle * freq + phaseOffsets[phase]);
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            y += value * amp;
        }

        // Ajout du bruit avec une influence réduite
        const noiseValue = noise1D(finalAngle * config.noiseScale) * 0.2 + (Math.random() - 0.5) * 0.1;
        y += noiseValue * heightVariation;

        maxY = Math.max(maxY, y);
        minY = Math.min(minY, y);

        // Générer et stocker un offset radial fixe pour chaque particule
        radialOffsets[i] = Math.random() * 2 - 1;
    }

    // Deuxième passage pour définir les positions et les couleurs
    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.particleCount) * Math.PI * 2;
        const progress = i / (config.particleCount - 1);

        // Réduction de la variation d'angle pour une distribution plus régulière
        const angleVariation = (Math.random() - 0.5) * 0.02;
        const finalAngle = angle + angleVariation;
        
        // Distribution radiale plus régulière avec variation minimale
        const randomFactor = 0.8 + Math.random() * 0.4; // Entre 0.8 et 1.2
        const layerOffset = (randomFactor - 1) * 0.04; // Variation réduite
        
        // État initial : toutes les particules presque sur le cercle de base
        const initialRadius = config.radius * (1 + layerOffset * 0.2);
        
        // État final : variation radiale légèrement plus prononcée
        const finalRadius = config.radius * (1 + layerOffset);

        // Positions initiales (quasi-régulières sur le cercle)
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;

        // Positions finales (légèrement plus variées)
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;

        // Calcul de la hauteur Y avec distribution contrôlée
        const thicknessVariation = (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.6);
        const baseThickness = lineThickness * (1 + thicknessVariation);
        const randomY = (Math.random() * 2 - 1) * baseThickness;
        let y = randomY;
        
        // Ajout des variations de hauteur de manière plus régulière
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            let value = Math.sin(finalAngle * freq + phaseOffsets[phase]);
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            y += value * amp;
        }

        // Ajout du bruit avec une influence réduite
        const noiseValue = noise1D(finalAngle * config.noiseScale) * 0.2 + (Math.random() - 0.5) * 0.1;
        y += noiseValue * heightVariation;

        // Définir la couleur en fonction de la hauteur normalisée
        const normalizedHeight = (y - minY) / (maxY - minY);
        if (normalizedHeight > config.greenThreshold) {
            // Couleur verte (#00FEA5)
            colors[i3] = 0.0;      // R
            colors[i3 + 1] = 0.996; // G (254/255)
            colors[i3 + 2] = 0.647; // B (165/255)
        } else {
            // Couleur blanche
            colors[i3] = 1.0;     // R
            colors[i3 + 1] = 1.0; // G
            colors[i3 + 2] = 1.0; // B
        }

        // Stockage des positions
        mainInitialPositions[i3] = initialX;
        mainInitialPositions[i3 + 1] = y;
        mainInitialPositions[i3 + 2] = initialZ;

        mainFinalPositions[i3] = finalX;
        mainFinalPositions[i3 + 1] = y;
        mainFinalPositions[i3 + 2] = finalZ;

        positions[i3] = initialX;
        positions[i3 + 1] = y;
        positions[i3 + 2] = initialZ;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('initialPosition', new THREE.BufferAttribute(mainInitialPositions, 3));
    geometry.setAttribute('finalPosition', new THREE.BufferAttribute(mainFinalPositions, 3));
    geometry.setAttribute('radialOffset', new THREE.BufferAttribute(radialOffsets, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: createParticleTexture() },
            pointSize: { value: config.particleSize }
        },
        vertexShader: `
            varying float vY;
            uniform float pointSize;
            
            void main() {
                vY = position.y;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = pointSize;
            }
        `,
        fragmentShader: `
            varying float vY;
            uniform sampler2D pointTexture;
            
            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = length(gl_PointCoord - center);
                float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
                
                vec3 color = vec3(1.0);
                if (vY > ${config.greenThreshold}) {
                    color = vec3(0.0, 254.0/255.0, 165.0/255.0); // #00FEA5
                }
                
                gl_FragColor = vec4(color, alpha);
                
                if (alpha < 0.01) discard;
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending
    });

    particles = new THREE.Points(geometry, material);
    particles.frustumCulled = true; // Active le frustum culling
    scene.add(particles);

    // Création des particules de la bordure
    const borderGeometry = new THREE.BufferGeometry();
    const borderPositions = new Float32Array(config.borderParticleCount * 3);
    const borderSizes = new Float32Array(config.borderParticleCount);
    const borderInitialPositions = new Float32Array(config.borderParticleCount * 3);
    const borderFinalPositions = new Float32Array(config.borderParticleCount * 3);

    for (let i = 0; i < config.borderParticleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.borderParticleCount) * Math.PI * 2;
        const progress = i / (config.borderParticleCount - 1);

        // Distribution radiale autour des particules principales
        const radialAngle = Math.random() * Math.PI * 2;
        const radialOffset = Math.random() * config.borderWidth;
        
        // Calcul de la position Y basée sur les courbes (avec amplitude réduite)
        let baseY = 0;
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] / Math.sqrt(phase + 1);
            
            let value = Math.sin(angle * freq + phaseOffsets[phase]);
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            
            baseY += value * amp;
        }

        // Ajout d'une variation aléatoire supplémentaire sur Y (réduite)
        baseY += (Math.random() * 2 - 1) * heightVariation;

        // Ajout du bruit avec variation réduite
        const noiseValue = Math.sin(angle * config.noiseScale) * 0.3;
        baseY += noiseValue * (heightVariation * 1.5);
        
        // Calcul de la position de base sur le cercle
        const baseRadius = config.radius + ((i % 3) - 1) * lineThickness;
        const baseX = Math.cos(angle) * baseRadius;
        const baseZ = Math.sin(angle) * baseRadius;

        // Calcul des offsets pour la position finale
        const offsetX = Math.cos(radialAngle) * radialOffset;
        const offsetY = (Math.random() - 0.5) * config.borderWidth;
        const offsetZ = Math.sin(radialAngle) * radialOffset;

        // Position initiale (plaquée sur le cercle avec Y modérément varié)
        borderInitialPositions[i3] = baseX;
        borderInitialPositions[i3 + 1] = baseY;
        borderInitialPositions[i3 + 2] = baseZ;

        // Position finale (avec les offsets)
        borderFinalPositions[i3] = baseX + offsetX;
        borderFinalPositions[i3 + 1] = baseY; // Garde la même position Y
        borderFinalPositions[i3 + 2] = baseZ + offsetZ;

        // Position de départ = position initiale
        borderPositions[i3] = borderInitialPositions[i3];
        borderPositions[i3 + 1] = borderInitialPositions[i3 + 1];
        borderPositions[i3 + 2] = borderInitialPositions[i3 + 2];

        // Calcul de la taille des particules en fonction de la distance
        const distanceFromBase = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
        const normalizedDistance = Math.min(distanceFromBase / config.borderWidth, 1);
        borderSizes[i] = config.borderParticleMaxSize * (1 - normalizedDistance) + config.borderParticleMinSize * normalizedDistance;
    }

    borderGeometry.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    borderGeometry.setAttribute('size', new THREE.BufferAttribute(borderSizes, 1));
    borderGeometry.setAttribute('initialPosition', new THREE.BufferAttribute(borderInitialPositions, 3));
    borderGeometry.setAttribute('finalPosition', new THREE.BufferAttribute(borderFinalPositions, 3));

    const borderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: createParticleTexture() }
        },
        vertexShader: `
            attribute float size;
            varying float vY;
            
            void main() {
                vY = position.y;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = size;
            }
        `,
        fragmentShader: `
            varying float vY;
            uniform sampler2D pointTexture;
            
            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = length(gl_PointCoord - center);
                float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
                
                vec3 color = vec3(1.0);
                if (vY > ${config.greenThreshold}) {
                    color = vec3(0.0, 254.0/255.0, 165.0/255.0); // #00FEA5
                }
                
                gl_FragColor = vec4(color, alpha);
                
                if (alpha < 0.01) discard;
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    borderParticles = new THREE.Points(borderGeometry, borderMaterial);
    borderParticles.frustumCulled = true; // Active le frustum culling
    scene.add(borderParticles);
}

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Fond transparent
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 64, 64);

    // Cercle net
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Gestion du redimensionnement
function onWindowResize() {
    if (!container) return;
    
    const aspect = container.clientWidth / container.clientHeight;
    const baseWidth = 1920; // Largeur de référence
    const frustumSize = (baseWidth / container.clientWidth) * 3.5;
    
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Fonction pour mettre en cache les éléments DOM
function cacheElements() {
    thresholdContainer = document.querySelector('.threshold-line-container');
    thresholdLine = document.querySelector('.threshold-line');
}

// Fonction pour mettre à jour la position de la barre de seuil
function updateThresholdLine(position, width, opacity) {
    if (!thresholdContainer || !thresholdLine) return;
    
    thresholdContainer.style.top = `${position}%`;
    
    if (width !== undefined) {
        thresholdLine.style.width = width;
    }
    
    if (opacity !== undefined) {
        thresholdLine.style.opacity = opacity;
    }
}

// Fonction pour throttle les événements fréquents
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Optimisation de la mise à jour des couleurs
function updateColors() {
    if (!particles) return;
    
    // Utiliser le remplacement de texte plutôt que de recompiler tout le shader
    if (particles.material && particles.material.fragmentShader) {
        particles.material.fragmentShader = particles.material.fragmentShader.replace(
            /if \(vY > ([-0-9.]+)\)/,
            `if (vY > ${config.greenThreshold})`
        );
        particles.material.needsUpdate = true;
    }

    // Même chose pour les particules de bordure
    if (borderParticles && borderParticles.material && borderParticles.material.fragmentShader) {
        borderParticles.material.fragmentShader = borderParticles.material.fragmentShader.replace(
            /if \(vY > ([-0-9.]+)\)/,
            `if (vY > ${config.greenThreshold})`
        );
        borderParticles.material.needsUpdate = true;
    }
}

// Optimisation de la fonction updateScroll
function updateScroll() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const scrollProgress = Math.min(100, Math.max(0, (scrolled / scrollHeight) * 100));
    const animationProgress = Math.min(90, scrollProgress);
    
    const scrollingUp = scrolled < lastScrollY;
    lastScrollY = scrolled;

    // Animation du seuil en fonction du scroll
    let newThreshold;
    if (scrollProgress <= 60) {
        // De 0 à 60% : animation du threshold de 0.01 à 0.17
        const progress = scrollProgress / 60;
        newThreshold = 0.01 + (0.17 - 0.01) * progress;
        
        // Mise à jour de la position de la barre horizontale
        const heightProgress = progress;
        const position = 46 - (heightProgress * 4.5); // Remontée jusqu'à 41.5%
        updateThresholdLine(position, '56%', '1');
    } else if (scrollProgress <= 72) {
        // De 60% à 72% : descente progressive de la barre de 41.5% à 70%
        const progress = (scrollProgress - 60) / 12; // Progression sur 12% de scroll
        
        // Animation du threshold sur toute la période 60-74%
        const thresholdProgress = (scrollProgress - 60) / 14;
        newThreshold = 0.17 + (-0.51 - 0.17) * thresholdProgress;
        
        const position = 41.5 + (progress * 28.5); // Descente progressive de 41.5% à 70%
        updateThresholdLine(position, '56%', '1');
    } else if (scrollProgress <= 80) {
        // De 72% à 80% : rétraction de la barre vers son centre
        const progress = (scrollProgress - 72) / 8;
        
        // Continue l'animation du threshold jusqu'à 74%
        if (scrollProgress <= 74) {
            const thresholdProgress = (scrollProgress - 60) / 14;
            newThreshold = 0.17 + (-0.51 - 0.17) * thresholdProgress;
        } else {
            newThreshold = -0.51; // Threshold fixe à -0.51
        }
        
        updateThresholdLine(70, `${56 * (1 - progress)}%`, `${1 - progress}`);
    } else {
        // Au-delà de 80%
        newThreshold = -0.51;
        updateThresholdLine(70, '0%', '0');
    }

    // Mise à jour du seuil de couleur uniquement si la valeur a changé
    if (Math.abs(config.greenThreshold - newThreshold) > 0.001) {
        config.greenThreshold = newThreshold;

        // Mise à jour de la valeur dans le contrôle (moins fréquente)
        if (scrollProgress % 5 < 1) { // 1 mise à jour sur 5 pour les contrôles UI
            const greenThresholdControl = document.getElementById('green-threshold');
            const greenThresholdValue = document.getElementById('green-threshold-value');
            if (greenThresholdControl && greenThresholdValue) {
                greenThresholdControl.value = newThreshold;
                greenThresholdValue.textContent = newThreshold.toFixed(2);
            }
        }
        updateColors();
    }

    // Animation des rotations et positions seulement si nous sommes en train de défiler
    if (particles) {
        // Rotation Y continue de 0° à -180° sur toute la durée du scroll (jusqu'à 100%)
        const rotationY = -(scrollProgress / 100) * (180 * Math.PI / 180);
        particles.rotation.y = rotationY;

        // Rotation X de 0° à -90° entre 60% et 90% de scroll (sens inverse)
        if (animationProgress > 60) {
            const rotationX = -((animationProgress - 60) / 30) * (90 * Math.PI / 180);
            particles.rotation.x = rotationX;

            // Animation de l'épaisseur pendant la rotation finale (60-90%)
            const deploymentProgress = (animationProgress - 60) / 30;
            
            // Animation des particules - méthode non-saccadée
            const mainPositions = particles.geometry.attributes.position.array;
            const mainInitialPos = particles.geometry.attributes.initialPosition.array;
            const mainFinalPos = particles.geometry.attributes.finalPosition.array;
            
            // Entre 60% et 90%, on met à jour toutes les particules à chaque frame
            if (animationProgress >= 60 && animationProgress <= 90) {
                // Calculer l'épaisseur radiale maximale (augmente de 0 à 0.1)
                const maxThickness = ((animationProgress - 60) / 30) * 0.1;
                const radialOffsets = particles.geometry.attributes.radialOffset.array;
                
                // Mettre à jour toutes les particules principales
                for (let i = 0; i < mainPositions.length; i += 3) {
                    const particleIndex = i / 3;
                    // Position de base avec déploiement progressif
                    const baseX = mainInitialPos[i] + (mainFinalPos[i] - mainInitialPos[i]) * deploymentProgress;
                    const baseZ = mainInitialPos[i + 2] + (mainFinalPos[i + 2] - mainInitialPos[i + 2]) * deploymentProgress;

                    // Calculer la direction radiale normalisée
                    const dx = baseX;
                    const dz = baseZ;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    const dirX = dx / dist;
                    const dirZ = dz / dist;
                    
                    // Utiliser l'offset radial pré-calculé
                    const radialOffset = radialOffsets[particleIndex] * maxThickness;
                    
                    // Appliquer l'offset dans la direction radiale
                    mainPositions[i] = baseX + dirX * radialOffset;
                    mainPositions[i + 1] = mainInitialPos[i + 1];
                    mainPositions[i + 2] = baseZ + dirZ * radialOffset;
                }
                particles.geometry.attributes.position.needsUpdate = true;
            } else if (scrollProgress % 2 === 0) {
                // En dehors de la plage 60-90%, on continue avec la mise à jour par lots
                const particlesPerBatch = Math.ceil(mainPositions.length / 9);
                const batchIndex = Math.floor(scrollProgress % 3);
                const startIdx = batchIndex * particlesPerBatch * 3;
                const endIdx = Math.min(startIdx + particlesPerBatch * 3, mainPositions.length);
                
                for (let i = startIdx; i < endIdx; i += 3) {
                    mainPositions[i] = mainInitialPos[i] + (mainFinalPos[i] - mainInitialPos[i]) * deploymentProgress;
                    mainPositions[i + 1] = mainInitialPos[i + 1];
                    mainPositions[i + 2] = mainInitialPos[i + 2] + (mainFinalPos[i + 2] - mainInitialPos[i + 2]) * deploymentProgress;
                }
                particles.geometry.attributes.position.needsUpdate = true;
            }
            
            // Toujours mettre à jour TOUTES les particules de bordure pour éviter les saccades
            if (borderParticles && borderParticles.geometry) {
                const positions = borderParticles.geometry.attributes.position.array;
                const initialPos = borderParticles.geometry.attributes.initialPosition.array;
                const finalPos = borderParticles.geometry.attributes.finalPosition.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] = initialPos[i] + (finalPos[i] - initialPos[i]) * deploymentProgress;
                    positions[i + 1] = initialPos[i + 1];
                    positions[i + 2] = initialPos[i + 2] + (finalPos[i + 2] - initialPos[i + 2]) * deploymentProgress;
                }
                borderParticles.geometry.attributes.position.needsUpdate = true;
            }
        } else {
            // Réinitialiser la rotation X si on remonte avant 60%
            particles.rotation.x = 0;
            
            // Réinitialiser les positions des particules principales par lots,
            // mais traiter toutes les particules de bordure à chaque fois
            if (scrollProgress % 5 === 0) {
                const mainPositions = particles.geometry.attributes.position.array;
                const mainInitialPos = particles.geometry.attributes.initialPosition.array;
                
                // Mise à jour d'un sous-ensemble de particules principales
                const particlesPerBatch = Math.ceil(mainPositions.length / 15); // 5 lots de particules (1/3 des particules tous les 5%)
                const batchIndex = Math.floor((scrollProgress / 5) % 5); // 0 à 4
                const startIdx = batchIndex * particlesPerBatch * 3;
                const endIdx = Math.min(startIdx + particlesPerBatch * 3, mainPositions.length);
                
                for (let i = startIdx; i < endIdx; i += 3) {
                    mainPositions[i] = mainInitialPos[i];
                    mainPositions[i + 1] = mainInitialPos[i + 1];
                    mainPositions[i + 2] = mainInitialPos[i + 2];
                }
                particles.geometry.attributes.position.needsUpdate = true;
                
                // Réinitialiser toutes les particules de bordure
                if (borderParticles && borderParticles.geometry) {
                    const positions = borderParticles.geometry.attributes.position.array;
                    const initialPos = borderParticles.geometry.attributes.initialPosition.array;
                    
                    for (let i = 0; i < positions.length; i += 3) {
                        positions[i] = initialPos[i];
                        positions[i + 1] = initialPos[i + 1];
                        positions[i + 2] = initialPos[i + 2];
                    }
                    borderParticles.geometry.attributes.position.needsUpdate = true;
                }
            }
        }

        // Gestion du zoom et de la distance max
        if (animationProgress < 40) {  // Modifié de 60% à 40%
            // En dessous de 40%, on force le zoom initial
            camera.zoom = config.initialZoom;
            camera.far = config.initialFar;
            camera.near = Math.max(0.1, config.initialFar * 0.1);
            camera.updateProjectionMatrix();
        } else if (animationProgress >= 40 && animationProgress <= 80) {  // Modifié de 60-80% à 40-80%
            const progress = (animationProgress - 40) / 40;  // 0 à 1 entre 40% et 80% (modifié de 60-80% à 40-80%)
            
            // Animation de la distance max
            const newFar = config.initialFar + (config.finalFar - config.initialFar) * progress;
            camera.far = newFar;
            camera.near = Math.max(0.1, newFar * 0.1);
            
            // Animation du zoom avec direction
            let newZoom;
            if (scrollingUp) {
                // En remontant : de finalZoom vers initialZoom
                newZoom = config.finalZoom + (config.initialZoom - config.finalZoom) * (1 - progress);
            } else {
                // En descendant : de initialZoom vers finalZoom
                newZoom = config.initialZoom + (config.finalZoom - config.initialZoom) * progress;
            }
            camera.zoom = newZoom;
            
            camera.updateProjectionMatrix();
        } else {
            // Au-delà de 80%, on maintient les valeurs finales
            camera.zoom = config.finalZoom;
            camera.far = config.finalFar;
            camera.near = Math.max(0.1, config.finalFar * 0.1);
            camera.updateProjectionMatrix();
        }

        // S'assurer que le point de pivot reste au centre
        particles.position.set(0, 0, 0);

        // Appliquer les mêmes rotations à la bordure
        if (borderParticles) {
            borderParticles.rotation.copy(particles.rotation);
        }
    }
}

// Gestionnaires d'événements pour les contrôles
function setupControls() {
    // Récupération des éléments de contrôle
    const curveCountControl = document.getElementById('curve-count');
    const curveCountValue = document.getElementById('curve-count-value');
    const mainParticleSizeControl = document.getElementById('main-particle-size');
    const mainParticleSizeValue = document.getElementById('main-particle-size-value');
    const borderParticleSizeControl = document.getElementById('border-particle-size');
    const borderParticleSizeValue = document.getElementById('border-particle-size-value');
    const particleCountControl = document.getElementById('particle-count');
    const particleCountValue = document.getElementById('particle-count-value');
    const curveAmplitudeControl = document.getElementById('curve-amplitude');
    const curveAmplitudeValue = document.getElementById('curve-amplitude-value');
    const maxThicknessControl = document.getElementById('max-thickness');
    const maxThicknessValue = document.getElementById('max-thickness-value');
    const minThicknessControl = document.getElementById('min-thickness');
    const minThicknessValue = document.getElementById('min-thickness-value');
    const toggleControlsBtn = document.getElementById('toggle-controls');
    const showControlsBtn = document.getElementById('show-controls');
    const controlsPanel = document.getElementById('controls-panel');
    const greenThresholdControl = document.getElementById('green-threshold');
    const greenThresholdValue = document.getElementById('green-threshold-value');
    const cameraFarControl = document.getElementById('camera-far');
    const cameraFarValue = document.getElementById('camera-far-value');

    // Gestion de l'affichage/masquage du panneau de contrôle
    toggleControlsBtn.addEventListener('click', () => {
        controlsPanel.style.display = 'none';
        showControlsBtn.style.display = 'block';
    });

    showControlsBtn.addEventListener('click', () => {
        controlsPanel.style.display = 'block';
        showControlsBtn.style.display = 'none';
    });

    // Gestionnaires d'événements pour les contrôles
    curveCountControl.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        config.curveFrequency = value;
        config.curvePhases = Math.max(2, Math.min(4, Math.floor(value / 3))); // Ajuste le nombre de phases en fonction de la fréquence
        
        // Réinitialisation des tableaux avec la nouvelle taille
        phaseOffsets = new Array(config.curvePhases);
        frequencyMultipliers = new Array(config.curvePhases);
        amplitudeMultipliers = new Array(config.curvePhases);
        
        // Mise à jour des tableaux de phases
        const phaseStep = (Math.PI * 2) / config.curvePhases;
        for (let i = 0; i < config.curvePhases; i++) {
            phaseOffsets[i] = i * phaseStep;
            frequencyMultipliers[i] = 1 - (i * 0.2); // Décroissance progressive des fréquences
            amplitudeMultipliers[i] = 1 - (i * 0.2); // Décroissance progressive des amplitudes
        }
        
        curveCountValue.textContent = value;
        updateParticles();
    });

    mainParticleSizeControl.addEventListener('input', (e) => {
        config.particleSize = parseFloat(e.target.value);
        mainParticleSizeValue.textContent = config.particleSize.toFixed(2);
        if (particles && particles.material.uniforms) {
            particles.material.uniforms.pointSize.value = config.particleSize;
        }
    });

    borderParticleSizeControl.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        borderParticleSizeValue.textContent = size.toFixed(2);
        if (borderParticles) {
            config.borderParticleMaxSize = size * 1.2;
            config.borderParticleMinSize = size * 0.8;
            const positions = borderParticles.geometry.attributes.position.array;
            const sizes = borderParticles.geometry.attributes.size.array;
            
            for (let i = 0; i < config.borderParticleCount; i++) {
                const i3 = i * 3;
                const baseX = positions[i3];
                const baseY = positions[i3 + 1];
                const baseZ = positions[i3 + 2];
                
                const distanceFromBase = Math.sqrt(
                    Math.pow(baseX - Math.cos(Math.atan2(baseZ, baseX)) * config.radius, 2) +
                    Math.pow(baseZ - Math.sin(Math.atan2(baseZ, baseX)) * config.radius, 2)
                );
                const normalizedDistance = Math.min(distanceFromBase / config.borderWidth, 1);
                sizes[i] = config.borderParticleMaxSize * (1 - normalizedDistance) + config.borderParticleMinSize * normalizedDistance;
            }
            
            borderParticles.geometry.attributes.size.needsUpdate = true;
        }
    });

    particleCountControl.addEventListener('input', (e) => {
        config.particleCount = parseInt(e.target.value);
        particleCountValue.textContent = config.particleCount;
        // Recréer les particules avec le nouveau compte
        if (particles) {
            scene.remove(particles);
        }
        if (borderParticles) {
            scene.remove(borderParticles);
        }
        createParticles();
    });

    curveAmplitudeControl.addEventListener('input', (e) => {
        heightVariation = parseFloat(e.target.value);
        curveAmplitudeValue.textContent = heightVariation.toFixed(2);
        updateParticles();
    });

    maxThicknessControl.addEventListener('input', (e) => {
        lineThickness = parseFloat(e.target.value);
        maxThicknessValue.textContent = lineThickness.toFixed(3);
        updateParticles();
    });

    minThicknessControl.addEventListener('input', (e) => {
        const minThickness = parseFloat(e.target.value);
        minThicknessValue.textContent = minThickness.toFixed(3);
        config.borderParticleMinSize = minThickness * 100;
        updateParticles();
    });

    greenThresholdControl.addEventListener('input', (e) => {
        config.greenThreshold = parseFloat(e.target.value);
        greenThresholdValue.textContent = config.greenThreshold.toFixed(2);
        updateColors();
    });

    cameraFarControl.addEventListener('input', (e) => {
        const farValue = parseFloat(e.target.value);
        config.initialFar = farValue;
        config.finalFar = farValue * 1.5; // Maintient le ratio entre initialFar et finalFar
        cameraFarValue.textContent = farValue.toFixed(1);
        
        // Met à jour la caméra immédiatement
        camera.far = farValue;
        camera.near = Math.max(0.1, farValue * 0.1); // Ajuste aussi le near pour éviter les problèmes de rendu
        camera.updateProjectionMatrix();
    });
}

// Démarrage
document.addEventListener('DOMContentLoaded', init);
