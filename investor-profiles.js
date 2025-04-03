import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const config = {
    radius: 1.5,
    particleCount: 1000,
    particleSize: 10.0,
    curveAmplitude: 0.22,
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
    initialZoom: 2.10,
    finalZoom: 0.8,  // Modifié de 1.50 à 1.10
    cameraNear: 1,
    cameraFar: 2.2,
    initialFar: 2.2,
    finalFar: 3.5,
    clipPlaneHeight: 0.5,
    clipPlanePosition: 0.0,
    // Configuration de la bordure
    borderWidth: 0.4,
    borderParticleCount: 2000,
    borderParticleSize: 6.80,
    borderParticleMaxSize: 6.80,
    borderParticleMinSize: 6.80,
    borderColor: 0xFFFFFF,
    thicknessVariationMultiplier: 5.0,
    // Configuration du rectangle vert
    greenLine: {
        width: 0.58,
        height: 0.02
    }
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
let thresholdContainer, thresholdLine;
let particleShader, borderShader;
let isScrolling = false;
let scrollTimeout;
let hasPrewarmed = false;
let targetRotationY = 0;
let currentRotationY = 0;
let targetRotationX = 0;
let currentRotationX = 0;
let visibilityObserver, prewarmObserver;
let currentZoom = 2.10;
let targetZoom = 2.10;
let currentFar = 2.2;
let targetFar = 2.2;
let progressBar, progressValue;

// Tableaux de positions
let mainInitialPositions;
let mainFinalPositions;
let positions;

// Tableaux de phases
let phaseOffsets = [0, Math.PI/2, Math.PI, Math.PI*3/2];
let frequencyMultipliers = [1, 0.5, 0.7, 0.3];
let amplitudeMultipliers = [1, 0.8, 0.6, 0.4];

// Ajouter ces variables au début du fichier
let planeMesh;

// Pré-allocation des vecteurs et matrices pour éviter les allocations pendant l'animation
const tempVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();

// Cache pour les calculs de particules
const particleCache = {
    positions: null,
    rotations: null,
    phases: null,
    offsets: null,
    deploymentProgress: null,
    thicknessProgress: null,
    borderPhases: null,
    borderDeploymentProgress: null,
    borderRadialProgress: null
};

// Cache pour les calculs fréquents
const mathCache = {
    sin: new Float32Array(360),
    cos: new Float32Array(360),
    phases: new Float32Array(config.particleCount + config.borderParticleCount),
    borderPhases: new Float32Array(config.particleCount + config.borderParticleCount)
};

// Pré-calcul des sinus et cosinus
for (let i = 0; i < 360; i++) {
    mathCache.sin[i] = Math.sin(i * Math.PI / 180);
    mathCache.cos[i] = Math.cos(i * Math.PI / 180);
}

// Pré-calcul des phases aléatoires
for (let i = 0; i < config.particleCount + config.borderParticleCount; i++) {
    mathCache.phases[i] = Math.random() * Math.PI * 2;
    mathCache.borderPhases[i] = Math.random() * Math.PI * 2;
}

// Optimisation des buffers de géométrie
function createOptimizedGeometry(particleCount) {
    const positions = new Float32Array(particleCount * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.attributes.position.usage = THREE.DynamicDrawUsage;
    return geometry;
}

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

// Fonctions d'interpolation pour des transitions plus fluides
function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Initialisation
function init() {
    // Récupération du conteneur
    container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    
    // Création de l'observer pour la visibilité
    visibilityObserver = createObserver(container);
    
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

    // Renderer avec optimisations spécifiques pour Chrome
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        stencil: false,
        depth: true,
        powerPreference: 'high-performance',
        precision: 'highp',
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        logarithmicDepthBuffer: false
    });
    
    // Optimisations du renderer
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setPixelRatio(1); // Force un pixel ratio de 1 pour de meilleures performances
    renderer.setClearColor(0x0B0E13, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Désactive les fonctionnalités non utilisées
    renderer.shadowMap.enabled = false;
    renderer.physicallyCorrectLights = false;
    
    renderer.info.autoReset = false;
    
    container.appendChild(renderer.domElement);

    // Initialiser l'IntersectionObserver pour le préchauffage
    prewarmObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasPrewarmed) {
                // Préchauffer le GPU avec quelques frames
                prewarmRenderer();
                hasPrewarmed = true;
            }
        });
    }, {
        rootMargin: '100px 0px',
        threshold: 0
    });

    prewarmObserver.observe(container);

    // Horloge
    clock = new THREE.Clock();

    // Cache les éléments de progression
    progressBar = document.querySelector('.loading-progress-bar');
    progressValue = document.querySelector('.loading-progress-value');

    // Création des particules
    createParticles();
    
    // Mettre à jour l'échelle initiale des particules
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
    }
    if (borderParticles && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
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

    // Création de la ligne de seuil
    const thresholdLineGeometry = new THREE.BufferGeometry();
    const lineWidth = 1; // Largeur de base de 1 unité
    const vertices = new Float32Array([
        -lineWidth/2, 0, 0,
        lineWidth/2, 0, 0
    ]);
    thresholdLineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const thresholdLineMaterial = new THREE.LineBasicMaterial({
        color: 0x00FEA5,
        linewidth: 2,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const thresholdLine = new THREE.Line(thresholdLineGeometry, thresholdLineMaterial);
    thresholdLine.renderOrder = 999;
    thresholdLine.position.set(0, config.clipPlanePosition - config.clipPlaneHeight, -1.5);
    thresholdLine.frustumCulled = false;
    scene.add(thresholdLine);

    // Remplacer planeMesh par thresholdLine dans les références
    planeMesh = thresholdLine;

    // Pré-allocation du cache de particules
    initializeParticleCache();

    // Initialisation des valeurs de zoom
    currentZoom = config.initialZoom;
    targetZoom = config.initialZoom;
    currentFar = config.initialFar;
    targetFar = config.initialFar;
    
    camera.zoom = currentZoom;
    camera.far = currentFar;
    camera.near = Math.max(0.1, currentFar * 0.1);
    camera.updateProjectionMatrix();
}

// Initialisation du cache de particules
function initializeParticleCache() {
    const totalParticles = config.particleCount + config.borderParticleCount;
    particleCache.positions = new Float32Array(totalParticles * 3);
    particleCache.rotations = new Float32Array(totalParticles * 4);
    particleCache.phases = new Float32Array(totalParticles);
    particleCache.offsets = new Float32Array(totalParticles * 3);
}

function updateProgressIndicator(scrollProgress) {
    if (progressBar && progressValue) {
        progressBar.style.setProperty('--progress', `${scrollProgress}%`);
        progressValue.textContent = `[ ${Math.round(scrollProgress)}% ]`;
    }
}

// Animation optimisée
function animate(timestamp) {
    requestAnimationFrame(animate);
    
    // Mise à jour de Lenis avec throttling
    if (window.lenis && (timestamp - lastFrameTime >= 16)) {
        window.lenis.raf(timestamp);
    }
    
    // Limite le framerate à ~60fps avec une marge de tolérance
    if (timestamp - lastFrameTime < 15.5) {
        return;
    }
    
    lastFrameTime = timestamp;

    // Calcul du scroll progress une seule fois
    const scrollProgress = calculateScrollProgress();
    
    // Mise à jour de l'indicateur de progression
    updateProgressIndicator(scrollProgress);

    // Animation des rotations avec Lenis
    if (particles) {
        // Calcul des rotations cibles
        const normalizedProgress = scrollProgress / 100;
        targetRotationY = -(normalizedProgress) * (180 * Math.PI / 180);
        
        if (scrollProgress > 60) {
            const rotationProgress = (scrollProgress - 60) / 30;
            targetRotationX = -(Math.min(1, rotationProgress)) * (90 * Math.PI / 180);
        } else {
            targetRotationX = 0;
        }

        // Utilisation de Lenis pour l'interpolation
        if (window.lenis) {
            const rotationLerp = window.lenis.options.lerp;
            
            // Interpolation de la rotation Y
            currentRotationY += (targetRotationY - currentRotationY) * rotationLerp;
            particles.rotation.y = currentRotationY;
            
            // Interpolation de la rotation X
            currentRotationX += (targetRotationX - currentRotationX) * rotationLerp;
            particles.rotation.x = currentRotationX;

            // Appliquer les rotations à la bordure
            if (borderParticles) {
                borderParticles.rotation.copy(particles.rotation);
            }
        }

        // Gestion du zoom et de la distance max
        if (scrollProgress < 40) {
            targetZoom = config.initialZoom;
            targetFar = config.initialFar;
        } else if (scrollProgress >= 40 && scrollProgress <= 80) {
            const progress = (scrollProgress - 40) / 40;
            targetZoom = config.initialZoom + (config.finalZoom - config.initialZoom) * progress;
            targetFar = config.initialFar + (config.finalFar - config.initialFar) * progress;
        } else {
            targetZoom = config.finalZoom;
            targetFar = config.finalFar;
        }

        // Interpolation douce avec Lenis
        if (window.lenis) {
            const lerpFactor = window.lenis.options.lerp;
            
            // Interpolation du zoom
            currentZoom += (targetZoom - currentZoom) * lerpFactor;
            camera.zoom = currentZoom;
            
            // Interpolation de la distance far
            currentFar += (targetFar - currentFar) * lerpFactor;
            camera.far = currentFar;
            camera.near = Math.max(0.1, currentFar * 0.1);
            
            camera.updateProjectionMatrix();

            // Ajuster l'échelle du rectangle pour le zoom courant
            if (planeMesh) {
                const scaleCompensation = config.initialZoom / currentZoom;
                const frustumSize = (camera.top - camera.bottom);
                const aspect = container.clientWidth / container.clientHeight;
                const targetWidth = frustumSize * aspect * 0.5 * config.greenLine.width;
                
                planeMesh.scale.set(
                    targetWidth * scaleCompensation,
                    1,
                    1
                );
            }
        }
    }

    // Mise à jour des particules
    if (particles && particles.geometry) {
        updateParticlesOptimized(timestamp, scrollProgress);
    }

    // Mise à jour des particules de bordure
    if (borderParticles && borderParticles.geometry) {
        updateBorderParticlesOptimized(timestamp, scrollProgress);
    }

    // Rendu optimisé
    renderer.render(scene, camera);
}

// Nouvelle fonction pour la mise à jour des particules de bordure
function updateBorderParticlesOptimized(timestamp, scrollProgress) {
    const positions = borderParticles.geometry.attributes.position.array;
    const initialPositions = borderParticles.geometry.attributes.initialPosition.array;
    const finalPositions = borderParticles.geometry.attributes.finalPosition.array;
    const time = timestamp * 0.001;

    // Utilisation du cache pré-alloué pour les calculs
    const batchSize = 1000;
    const totalParticles = positions.length / 3;
    
    // Utilisation de Lenis pour l'interpolation du déploiement
    const deploymentLerp = window.lenis ? window.lenis.options.lerp : 0.1;
    
    // Initialiser le cache des phases pour les bordures si nécessaire
    if (!particleCache.borderPhases) {
        particleCache.borderPhases = new Float32Array(totalParticles);
        for (let i = 0; i < totalParticles; i++) {
            particleCache.borderPhases[i] = Math.random() * Math.PI * 2;
        }
    }

    // Initialiser les caches de progression si nécessaire
    if (!particleCache.borderDeploymentProgress) {
        particleCache.borderDeploymentProgress = new Float32Array(totalParticles);
    }
    if (!particleCache.borderRadialProgress) {
        particleCache.borderRadialProgress = new Float32Array(totalParticles);
    }
    
    // Calculer les valeurs cibles en fonction du scroll
    const isDeploying = scrollProgress >= 60;
    const deploymentProgress = isDeploying ? (scrollProgress - 60) / 30 : 0;
    const targetDeployment = Math.min(1, deploymentProgress);
    const targetRadial = Math.min(1, deploymentProgress);
    
    for (let batch = 0; batch < totalParticles; batch += batchSize) {
        const end = Math.min(batch + batchSize, totalParticles);
        
        for (let i = batch; i < end; i++) {
            const i3 = i * 3;
            const phase = particleCache.borderPhases[i];

            // Effet de flottement de base (toujours actif)
            const floatX = Math.sin(time * 1.5 + phase) * 0.015;
            const floatY = Math.cos(time * 1.8 + phase) * 0.015;
            const floatZ = Math.sin(time * 2.0 + phase) * 0.015;

            // Position de base
            let baseX = initialPositions[i3];
            let baseZ = initialPositions[i3 + 2];

            // Initialiser les progressions si nécessaire
            if (particleCache.borderDeploymentProgress[i] === undefined) {
                particleCache.borderDeploymentProgress[i] = 0;
            }
            if (particleCache.borderRadialProgress[i] === undefined) {
                particleCache.borderRadialProgress[i] = 0;
            }

            // Interpolation des progressions avec Lenis
            particleCache.borderDeploymentProgress[i] += (targetDeployment - particleCache.borderDeploymentProgress[i]) * deploymentLerp;
            particleCache.borderRadialProgress[i] += (targetRadial - particleCache.borderRadialProgress[i]) * deploymentLerp;

            const currentDeployment = particleCache.borderDeploymentProgress[i];
            const currentRadial = particleCache.borderRadialProgress[i];

            // Calculer la position déployée
            const deployedX = initialPositions[i3] + (finalPositions[i3] - initialPositions[i3]) * currentDeployment;
            const deployedZ = initialPositions[i3 + 2] + (finalPositions[i3 + 2] - initialPositions[i3 + 2]) * currentDeployment;

            // Calculer la direction radiale
            const dx = deployedX;
            const dz = deployedZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const dirX = dx / dist;
            const dirZ = dz / dist;

            // Distribution radiale plus équilibrée avec amplitude réduite vers l'extérieur
            const radialDirection = ((i % 3) - 1); // Donne -1, 0, ou 1
            let radialOffset;
            if (radialDirection > 0) {
                // Pour les particules allant vers l'extérieur (radialDirection = 1)
                radialOffset = currentRadial * 0.05 * radialDirection;
            } else {
                // Pour les particules allant vers l'intérieur (radialDirection = -1) ou restant sur place (radialDirection = 0)
                radialOffset = currentRadial * 0.08 * radialDirection;
            }

            baseX = deployedX + dirX * radialOffset;
            baseZ = deployedZ + dirZ * radialOffset;

            // Application de la position finale avec le flottement
            positions[i3] = baseX + floatX;
            positions[i3 + 1] = initialPositions[i3 + 1] + floatY;
            positions[i3 + 2] = baseZ + floatZ;
        }
    }
    
    borderParticles.geometry.attributes.position.needsUpdate = true;
}

// Mise à jour optimisée des particules avec le scroll progress en paramètre
function updateParticlesOptimized(timestamp, scrollProgress) {
    const positions = particles.geometry.attributes.position.array;
    const initialPositions = particles.geometry.attributes.initialPosition.array;
    const finalPositions = particles.geometry.attributes.finalPosition.array;
    const radialOffsets = particles.geometry.attributes.radialOffset.array;
    const time = timestamp * 0.001;

    // Utilisation du cache pré-alloué pour les calculs
    const batchSize = 1000;
    const totalParticles = positions.length / 3;
    
    // Utilisation de Lenis pour l'interpolation du déploiement
    const deploymentLerp = window.lenis ? window.lenis.options.lerp : 0.1;

    // Initialiser les caches si nécessaire
    if (!particleCache.phases) {
        particleCache.phases = new Float32Array(totalParticles);
        for (let i = 0; i < totalParticles; i++) {
            particleCache.phases[i] = Math.random() * Math.PI * 2;
        }
    }
    if (!particleCache.deploymentProgress) {
        particleCache.deploymentProgress = new Float32Array(totalParticles);
    }
    if (!particleCache.thicknessProgress) {
        particleCache.thicknessProgress = new Float32Array(totalParticles);
    }

    // Calculer les valeurs cibles en fonction du scroll
    const isDeploying = scrollProgress >= 60;
    const deploymentProgress = isDeploying ? (scrollProgress - 60) / 30 : 0;
    const targetDeployment = Math.min(1, deploymentProgress);
    const targetThickness = isDeploying ? Math.min(0.1, deploymentProgress * 0.1) : 0;
    
    for (let batch = 0; batch < totalParticles; batch += batchSize) {
        const end = Math.min(batch + batchSize, totalParticles);
        
        for (let i = batch; i < end; i++) {
            const i3 = i * 3;
            
            // Réutilisation des valeurs du cache
            if (!particleCache.phases[i]) {
                particleCache.phases[i] = Math.random() * Math.PI * 2;
            }
            const phase = particleCache.phases[i];

            // Effet de flottement de base (toujours actif)
            const floatX = Math.sin(time * 1.5 + phase) * 0.015;
            const floatY = Math.cos(time * 1.8 + phase) * 0.015;
            const floatZ = Math.sin(time * 2.0 + phase) * 0.015;

            // Position de base
            let baseX = initialPositions[i3];
            let baseZ = initialPositions[i3 + 2];

            // Initialiser les progressions si nécessaire
            if (particleCache.deploymentProgress[i] === undefined) {
                particleCache.deploymentProgress[i] = 0;
            }
            if (particleCache.thicknessProgress[i] === undefined) {
                particleCache.thicknessProgress[i] = 0;
            }

            // Interpolation des progressions avec Lenis
            particleCache.deploymentProgress[i] += (targetDeployment - particleCache.deploymentProgress[i]) * deploymentLerp;
            particleCache.thicknessProgress[i] += (targetThickness - particleCache.thicknessProgress[i]) * deploymentLerp;

            const currentDeployment = particleCache.deploymentProgress[i];
            const currentThickness = particleCache.thicknessProgress[i];

            // Calculer la position déployée
            const deployedX = initialPositions[i3] + (finalPositions[i3] - initialPositions[i3]) * currentDeployment;
            const deployedZ = initialPositions[i3 + 2] + (finalPositions[i3 + 2] - initialPositions[i3 + 2]) * currentDeployment;

            // Calculer la direction radiale
            const dx = deployedX;
            const dz = deployedZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const dirX = dx / dist;
            const dirZ = dz / dist;

            // Appliquer l'épaisseur radiale
            const radialOffset = radialOffsets[i] * currentThickness;
            baseX = deployedX + dirX * radialOffset;
            baseZ = deployedZ + dirZ * radialOffset;

            // Application de la position finale avec le flottement
            positions[i3] = baseX + floatX;
            positions[i3 + 1] = initialPositions[i3 + 1] + floatY;
            positions[i3 + 2] = baseZ + floatZ;
        }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
}

// Calcul optimisé du scroll progress
function calculateScrollProgress() {
    const airdropSection = document.querySelector('.airdrop');
    const airdropRect = airdropSection.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const startPoint = windowHeight * 0.6;
    const sectionTop = airdropRect.top;
    
    if (sectionTop > startPoint || airdropRect.bottom <= 0) {
        return 0;
    }
    
    const totalHeight = airdropRect.height - windowHeight;
    const currentScroll = -airdropRect.top;
    const scrollAtStart = -startPoint;
    const adjustedScroll = currentScroll - scrollAtStart;
    const adjustedTotal = totalHeight - scrollAtStart;
    
    return Math.min(100, Math.max(0, Math.round((adjustedScroll / adjustedTotal) * 100)));
}

// Fonction de préchauffage du renderer
function prewarmRenderer() {
    console.log('Préchauffe du renderer...');
    
    // Sauvegarder l'état actuel
    const currentScrollProgress = window.scrollY;
    
    // Simuler différents états de scroll pour compiler tous les shaders
    const testScrollPositions = [0, 30, 60, 90, 100];
    
    testScrollPositions.forEach(scrollProgress => {
        // Simuler les différentes positions de scroll
        if (particles) {
            // Rotation Y
            const rotationY = -(scrollProgress / 100) * (180 * Math.PI / 180);
            particles.rotation.y = rotationY;

            // Rotation X (entre 60% et 90%)
            if (scrollProgress > 60) {
                const rotationX = -((Math.min(scrollProgress, 90) - 60) / 30) * (90 * Math.PI / 180);
                particles.rotation.x = rotationX;
            } else {
                particles.rotation.x = 0;
            }

            if (borderParticles) {
                borderParticles.rotation.copy(particles.rotation);
            }
        }

        // Forcer le rendu
        renderer.render(scene, camera);
    });

    // Restaurer l'état initial
    if (particles) {
        particles.rotation.set(0, 0, 0);
        if (borderParticles) {
            borderParticles.rotation.set(0, 0, 0);
        }
    }
    
    console.log('Préchauffage terminé');
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

    // Ajouter après la création des attributs de géométrie dans createParticles()
    const particlePhases = new Float32Array(config.particleCount);
    for (let i = 0; i < config.particleCount; i++) {
        particlePhases[i] = Math.random() * Math.PI * 2;
    }
    geometry.setAttribute('phase', new THREE.BufferAttribute(particlePhases, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointSize: { value: config.particleSize },
            scaleFactor: { value: 1.0 },
            clipPlaneHeight: { value: config.clipPlaneHeight },
            clipPlanePosition: { value: config.clipPlanePosition },
            time: { value: 0.0 }
        },
        vertexShader: `
            uniform float pointSize;
            uniform float scaleFactor;
            uniform float clipPlaneHeight;
            uniform float clipPlanePosition;
            uniform float time;
            
            attribute vec3 offset;
            attribute float phase;
            
            varying vec4 vClipPos;
            varying float vY;
            
            void main() {
                // Calculer le mouvement de flottement
                float floatAmplitude = 0.015;
                vec3 floatOffset = vec3(
                    sin(time * 0.5 + phase) * offset.x,
                    cos(time * 0.4 + phase) * offset.y,
                    sin(time * 0.6 + phase) * offset.z
                ) * floatAmplitude;
                
                // Appliquer le mouvement à la position
                vec3 finalPosition = position + floatOffset;
                vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                vClipPos = gl_Position;
                vY = finalPosition.y;
                gl_PointSize = pointSize * scaleFactor;
            }
        `,
        fragmentShader: `
            uniform float clipPlaneHeight;
            uniform float clipPlanePosition;
            
            varying vec4 vClipPos;
            varying float vY;
            
            void main() {
                // Calculer la distance au centre du point
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                float r = dot(cxy, cxy);
                
                // Antialiasing doux
                float delta = fwidth(r);
                float alpha = 1.0 - smoothstep(1.0 - delta, 1.0, r);
                
                // Si complètement transparent, discard
                if (alpha <= 0.0) {
                    discard;
                }
                
                vec3 color = vec3(1.0);
                float threshold = (clipPlanePosition - clipPlaneHeight) * 2.0;
                
                if (vY >= threshold) {
                    color = vec3(0.0, 254.0/255.0, 165.0/255.0);
                }
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false
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

    // Ajouter les mêmes attributs pour les particules de bordure
    const borderParticlePhases = new Float32Array(config.borderParticleCount);
    for (let i = 0; i < config.borderParticleCount; i++) {
        borderParticlePhases[i] = Math.random() * Math.PI * 2;
    }
    borderGeometry.setAttribute('phase', new THREE.BufferAttribute(borderParticlePhases, 1));

    const borderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            pointSize: { value: config.borderParticleSize },
            scaleFactor: { value: 1.0 },
            clipPlaneHeight: { value: config.clipPlaneHeight },
            clipPlanePosition: { value: config.clipPlanePosition },
            time: { value: 0.0 }
        },
        vertexShader: `
            uniform float pointSize;
            uniform float scaleFactor;
            uniform float clipPlaneHeight;
            uniform float clipPlanePosition;
            uniform float time;
            
            attribute vec3 offset;
            attribute float phase;
            
            varying vec4 vClipPos;
            varying float vY;
            
            void main() {
                // Calculer le mouvement de flottement
                float floatAmplitude = 0.015;
                vec3 floatOffset = vec3(
                    sin(time * 0.5 + phase) * offset.x,
                    cos(time * 0.4 + phase) * offset.y,
                    sin(time * 0.6 + phase) * offset.z
                ) * floatAmplitude;
                
                // Appliquer le mouvement à la position
                vec3 finalPosition = position + floatOffset;
                vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                vClipPos = gl_Position;
                vY = finalPosition.y;
                gl_PointSize = pointSize * scaleFactor;
            }
        `,
        fragmentShader: `
            uniform float clipPlaneHeight;
            uniform float clipPlanePosition;
            
            varying vec4 vClipPos;
            varying float vY;
            
            void main() {
                // Calculer la distance au centre du point
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                float r = dot(cxy, cxy);
                
                // Antialiasing doux
                float delta = fwidth(r);
                float alpha = 1.0 - smoothstep(1.0 - delta, 1.0, r);
                
                // Si complètement transparent, discard
                if (alpha <= 0.0) {
                    discard;
                }
                
                vec3 color = vec3(1.0);
                float threshold = (clipPlanePosition - clipPlaneHeight) * 2.0;
                
                if (vY >= threshold) {
                    color = vec3(0.0, 254.0/255.0, 165.0/255.0);
                }
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false
    });

    borderParticles = new THREE.Points(borderGeometry, borderMaterial);
    borderParticles.frustumCulled = true; // Active le frustum culling
    scene.add(borderParticles);
}

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Augmentation de la résolution
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Fond transparent
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 128, 128);

    // Cercle net sans antialiasing
    ctx.beginPath();
    ctx.arc(64, 64, 63, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    // Désactiver le filtrage bilinéaire pour des bords plus nets
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
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
    
    // Mettre à jour l'échelle des particules
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
        particles.material.uniforms.pointSize.value = config.particleSize;
    }
    if (borderParticles && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
        borderParticles.material.uniforms.pointSize.value = config.borderParticleSize;
    }
    
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
function updateClipPlane() {
    if (!particles || !particles.material || !particles.material.uniforms) return;
    
    particles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
    particles.material.uniforms.clipPlanePosition.value = config.clipPlanePosition;

    if (borderParticles && borderParticles.material && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
        borderParticles.material.uniforms.clipPlanePosition.value = config.clipPlanePosition;
    }
}

// Optimisation de la fonction updateScroll
function updateScroll() {
    const airdropSection = document.querySelector('.airdrop');
    const airdropRect = airdropSection.getBoundingClientRect();
    const currentScrolled = window.scrollY;
    const windowHeight = window.innerHeight;
    
    // Calcul du point où la section atteint 60% du viewport
    const startPoint = windowHeight * 0.6;
    const sectionTop = airdropRect.top;
    
    // Si la section n'est pas encore visible ou est déjà passée, on ne fait rien
    if (sectionTop > startPoint || airdropRect.bottom <= 0) {
        lastScrollY = currentScrolled;
        return;
    }

    // Calcul de la progression
    const totalHeight = airdropRect.height - windowHeight; // Distance totale de scroll originale
    const currentScroll = -airdropRect.top; // Position actuelle du scroll
    const scrollAtStart = -startPoint; // Position du scroll quand la section est à 60% du viewport
    
    // Calcul de la progression ajustée
    const adjustedScroll = currentScroll - scrollAtStart; // Distance scrollée depuis le nouveau point de départ
    const adjustedTotal = totalHeight - scrollAtStart; // Distance totale ajustée
    const scrollProgress = Math.min(100, Math.max(0, (adjustedScroll / adjustedTotal) * 100));
    
    const animationProgress = Math.min(90, scrollProgress);
    const scrollingUp = currentScrolled < lastScrollY;
    lastScrollY = currentScrolled;

    // Animation du plan en fonction du scroll
    if (scrollProgress <= 32) {
        // De 0 à 32% : maintient 50% de hauteur
        config.clipPlaneHeight = 0.5;
        config.clipPlanePosition = 0.5;
        
    } else if (scrollProgress <= 40) {
        // De 32% à 40% : réduction à 40% de hauteur
        const progress = (scrollProgress - 32) / 8;
        config.clipPlaneHeight = 0.5 - (progress * 0.1); // De 50% à 40%
        config.clipPlanePosition = 0.5;
        
    } else if (scrollProgress <= 46) {
        // De 40% à 46% : maintient 40% de hauteur
        config.clipPlaneHeight = 0.4;
        config.clipPlanePosition = 0.5;
        
    } else if (scrollProgress <= 52) {
        // De 46% à 52% : extension à 100% de hauteur
        const progress = (scrollProgress - 46) / 6;
        config.clipPlaneHeight = 0.4 + (progress * 0.6); // De 40% à 100%
        config.clipPlanePosition = 0.5 - (progress * 0.5); // Descend au centre
        
    } else {
        // Au-delà de 52% : maintient 100%
        config.clipPlaneHeight = 1.0;
        config.clipPlanePosition = 0.0;
    }

    // Mettre à jour les uniforms du plan
    updateClipPlane();

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
                const particlesPerBatch = Math.ceil(mainPositions.length / 15);
                const batchIndex = Math.floor((scrollProgress / 5) % 5);
                const startIdx = batchIndex * particlesPerBatch * 3;
                const endIdx = Math.min(startIdx + particlesPerBatch * 3, mainPositions.length);
                
                for (let i = startIdx; i < endIdx; i += 3) {
                    mainPositions[i] = mainInitialPos[i];
                    mainPositions[i + 1] = mainInitialPos[i + 1];
                    mainPositions[i + 2] = mainInitialPos[i + 2];
                }
                particles.geometry.attributes.position.needsUpdate = true;
                
                // Réinitialiser toutes les particules de bordure avec une transition plus douce
                if (borderParticles && borderParticles.geometry) {
                    const positions = borderParticles.geometry.attributes.position.array;
                    const initialPos = borderParticles.geometry.attributes.initialPosition.array;
                    
                    // Calculer un facteur de transition basé sur le scroll
                    const transitionFactor = Math.max(0, Math.min(1, scrollProgress / 5));
                    
                    for (let i = 0; i < positions.length; i += 3) {
                        // Position actuelle
                        const currentX = positions[i];
                        const currentY = positions[i + 1];
                        const currentZ = positions[i + 2];
                        
                        // Position initiale
                        const targetX = initialPos[i];
                        const targetY = initialPos[i + 1];
                        const targetZ = initialPos[i + 2];
                        
                        // Interpolation douce entre la position actuelle et la position initiale
                        positions[i] = currentX + (targetX - currentX) * transitionFactor;
                        positions[i + 1] = currentY + (targetY - currentY) * transitionFactor;
                        positions[i + 2] = currentZ + (targetZ - currentZ) * transitionFactor;
                    }
                    borderParticles.geometry.attributes.position.needsUpdate = true;
                }
            }
        }

        // Gestion du zoom et de la distance max avec Lenis
        if (animationProgress < 40) {  // En dessous de 40%
            targetZoom = config.initialZoom;
            targetFar = config.initialFar;
        } else if (animationProgress >= 40 && animationProgress <= 80) {
            const progress = (animationProgress - 40) / 40;
            targetFar = config.initialFar + (config.finalFar - config.initialFar) * progress;
            targetZoom = config.initialZoom + (config.finalZoom - config.initialZoom) * progress;
        } else {
            targetZoom = config.finalZoom;
            targetFar = config.finalFar;
        }

        // Interpolation douce avec Lenis
        if (window.lenis) {
            const lerpFactor = window.lenis.options.lerp;
            
            // Interpolation du zoom
            currentZoom += (targetZoom - currentZoom) * lerpFactor;
            camera.zoom = currentZoom;
            
            // Interpolation de la distance far
            currentFar += (targetFar - currentFar) * lerpFactor;
            camera.far = currentFar;
            camera.near = Math.max(0.1, currentFar * 0.1);
            
            camera.updateProjectionMatrix();

            // Ajuster l'échelle du rectangle pour le zoom courant
            if (planeMesh) {
                const scaleCompensation = config.initialZoom / currentZoom;
                const frustumSize = (camera.top - camera.bottom);
                const aspect = container.clientWidth / container.clientHeight;
                const targetWidth = frustumSize * aspect * 0.5 * config.greenLine.width;
                
                planeMesh.scale.set(
                    targetWidth * scaleCompensation,
                    1,
                    1
                );
            }
        }
    }

    if (planeMesh) {
        // Calcul de la position du plan dans l'espace NDC (-1 à 1)
        const planeBottom = config.clipPlanePosition - config.clipPlaneHeight;
        
        // Conversion de l'espace NDC (-1 à 1) vers l'espace monde
        const worldY = planeBottom * 2;
        planeMesh.position.y = worldY;
        
        // Mettre à jour la position dans le shader des particules
        if (particles && particles.material && particles.material.uniforms && particles.material.uniforms.linePosition) {
            particles.material.uniforms.linePosition.value = worldY;
        }
        
        // Ajuste l'échelle du plan en fonction du zoom de la caméra
        const scaleCompensation = config.initialZoom / camera.zoom;
        
        // Calcul de la largeur et de l'opacité en fonction de la progression
        let widthScale = 1;
        let opacity = 1;
        
        // Disparition progressive de la ligne entre 48% et 50%
        if (scrollProgress >= 48.0 && scrollProgress <= 50.0) {
            const fadeProgress = (scrollProgress - 48.0) / 2.0;
            widthScale = Math.max(0, 1 - fadeProgress);
            opacity = Math.max(0, 1 - fadeProgress);
        } else if (scrollProgress > 50.0) {
            widthScale = 0;
            opacity = 0;
        }
        
        // Calcul de la largeur avec le facteur de largeur personnalisé
        const frustumSize = (camera.top - camera.bottom);
        const aspect = container.clientWidth / container.clientHeight;
        const targetWidth = frustumSize * aspect * 0.5 * config.greenLine.width;
        
        // Appliquer l'échelle
        planeMesh.scale.set(
            targetWidth * scaleCompensation * widthScale,
            1,
            1
        );
        
        // Appliquer l'opacité au matériau
        planeMesh.material.opacity = opacity;
        planeMesh.visible = opacity > 0;
    }
}

// Fonction pour mettre à jour les particules
function updateParticles() {
    // Sauvegarder les tailles actuelles des particules
    const currentMainSize = particles ? particles.material.uniforms.pointSize.value : config.particleSize;
    const currentBorderSize = borderParticles ? borderParticles.material.uniforms.pointSize.value : config.borderParticleSize;

    // Supprimer les particules existantes
    if (particles) {
        particles.geometry.dispose();
        particles.material.dispose();
        scene.remove(particles);
    }
    if (borderParticles) {
        borderParticles.geometry.dispose();
        borderParticles.material.dispose();
        scene.remove(borderParticles);
    }

    // Sauvegarder temporairement les valeurs de configuration
    const originalMainSize = config.particleSize;
    const originalBorderSize = config.borderParticleSize;
    
    // Appliquer les tailles actuelles
    config.particleSize = currentMainSize;
    config.borderParticleSize = currentBorderSize;
    config.borderParticleMaxSize = currentBorderSize;
    config.borderParticleMinSize = currentBorderSize;

    // Recréer les particules avec les nouveaux paramètres
    createParticles();

    // Restaurer les valeurs de configuration originales
    config.particleSize = originalMainSize;
    config.borderParticleSize = originalBorderSize;
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
    const cameraFarControl = document.getElementById('camera-far');
    const cameraFarValue = document.getElementById('camera-far-value');
    const clipPlaneHeightControl = document.getElementById('clip-plane-height');
    const clipPlaneHeightValue = document.getElementById('clip-plane-height-value');
    const clipPlanePositionControl = document.getElementById('clip-plane-position');
    const clipPlanePositionValue = document.getElementById('clip-plane-position-value');
    const initialZoomControl = document.getElementById('initial-zoom');
    const initialZoomValue = document.getElementById('initial-zoom-value');
    const finalZoomControl = document.getElementById('final-zoom');
    const finalZoomValue = document.getElementById('final-zoom-value');
    const lineWidthControl = document.getElementById('line-width');
    const lineWidthValue = document.getElementById('line-width-value');

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
        const size = parseFloat(e.target.value);
        config.particleSize = size;
        mainParticleSizeValue.textContent = size.toFixed(2);
        if (particles && particles.material.uniforms) {
            particles.material.uniforms.pointSize.value = size;
        }
    });

    borderParticleSizeControl.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        config.borderParticleSize = size;
        config.borderParticleMaxSize = size;
        config.borderParticleMinSize = size;
        borderParticleSizeValue.textContent = size.toFixed(2);
        if (borderParticles && borderParticles.material.uniforms) {
            borderParticles.material.uniforms.pointSize.value = size;
        }
    });

    particleCountControl.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        config.particleCount = value;
        config.borderParticleCount = Math.floor(value * 0.77); // Maintient le ratio entre particules principales et bordure
        particleCountValue.textContent = value;
        updateParticles();
    });

    curveAmplitudeControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config.curveAmplitude = value;
        curveAmplitudeValue.textContent = value.toFixed(2);
        updateParticles();
    });

    maxThicknessControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config.thicknessVariationMultiplier = value;
        maxThicknessValue.textContent = value.toFixed(2);
        updateParticles();
    });

    minThicknessControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        lineThickness = value;
        minThicknessValue.textContent = value.toFixed(2);
        updateParticles();
    });

    cameraFarControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config.finalFar = value;
        config.initialFar = value;
        cameraFarValue.textContent = value.toFixed(2);
        updateParticles();
    });

    clipPlaneHeightControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config.clipPlaneHeight = value;
        clipPlaneHeightValue.textContent = value.toFixed(2);
        updateClipPlane();
    });

    clipPlanePositionControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        config.clipPlanePosition = value;
        clipPlanePositionValue.textContent = value.toFixed(2);
        updateClipPlane();
    });

    // Gestionnaires d'événements pour les contrôles de zoom
    if (initialZoomControl) {
        initialZoomControl.value = config.initialZoom;
        initialZoomValue.textContent = config.initialZoom.toFixed(2);
        
        initialZoomControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            config.initialZoom = value;
            initialZoomValue.textContent = value.toFixed(2);
            
            // Mettre à jour immédiatement le zoom si on est dans la phase initiale
            const airdropSection = document.querySelector('.airdrop');
            const airdropRect = airdropSection.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const startPoint = windowHeight * 0.6;
            const sectionTop = airdropRect.top;
            
            if (sectionTop > startPoint || -airdropRect.top < windowHeight * 0.4) {
                camera.zoom = value;
                camera.updateProjectionMatrix();
            }
        });
    }

    if (finalZoomControl) {
        finalZoomControl.value = config.finalZoom;
        finalZoomValue.textContent = config.finalZoom.toFixed(2);
        
        finalZoomControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            config.finalZoom = value;
            finalZoomValue.textContent = value.toFixed(2);
            
            // Mettre à jour immédiatement le zoom si on est dans la phase finale
            const airdropSection = document.querySelector('.airdrop');
            const airdropRect = airdropSection.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const totalHeight = airdropRect.height - windowHeight;
            const currentScroll = -airdropRect.top;
            const scrollProgress = Math.min(100, Math.max(0, (currentScroll / totalHeight) * 100));
            
            if (scrollProgress > 80) {
                camera.zoom = value;
                camera.updateProjectionMatrix();
            }
        });
    }

    // Gestionnaire pour la largeur de la ligne verte
    if (lineWidthControl) {
        lineWidthControl.value = config.greenLine.width;
        lineWidthValue.textContent = config.greenLine.width.toFixed(1);
        
        lineWidthControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            config.greenLine.width = value;
            lineWidthValue.textContent = value.toFixed(1);
            
            // Forcer une mise à jour immédiate de la largeur
            if (planeMesh) {
                const frustumSize = (camera.top - camera.bottom);
                const aspect = container.clientWidth / container.clientHeight;
                const targetWidth = frustumSize * aspect * 0.5 * value;
                planeMesh.scale.x = targetWidth;
            }
        });
    }
}

// Optimisation des événements de redimensionnement
let resizeTimeout;
const resizeThrottleTime = 150;

function handleResize() {
    if (!resizeTimeout) {
        resizeTimeout = setTimeout(() => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            
            renderer.setSize(width, height, false);
            
            resizeTimeout = null;
        }, resizeThrottleTime);
    }
}

// Optimisation de la visibilité
let isCanvasVisible = true;
const createObserver = (container) => {
    const observer = new IntersectionObserver((entries) => {
        isCanvasVisible = entries[0].isIntersecting;
    }, {
        threshold: 0.1
    });
    
    observer.observe(container);
    return observer;
};

// Nettoyage des ressources
function dispose() {
    if (visibilityObserver) {
        visibilityObserver.disconnect();
    }
    if (prewarmObserver) {
        prewarmObserver.disconnect();
    }
    window.removeEventListener('resize', handleResize);
    
    if (geometry) geometry.dispose();
    if (material) material.dispose();
    if (renderer) renderer.dispose();
    
    // Nettoyage des caches
    for (const key in particleCache) {
        if (particleCache[key] && particleCache[key].length) {
            particleCache[key] = null;
        }
    }
    
    for (const key in mathCache) {
        if (mathCache[key] && mathCache[key].length) {
            mathCache[key] = null;
        }
    }
}

// Gestion du cycle de vie
window.addEventListener('resize', handleResize);
window.addEventListener('beforeunload', dispose);

// Démarrage
document.addEventListener('DOMContentLoaded', () => {
    init();
    // L'observer sera créé dans init() une fois que le container est disponible
});
