import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const config = {
    radius: 1.5,
    particleCount: 500,
    particleSize: 12.0,
    curveAmplitude: 0.13,
    curveFrequency: 9,
    curvePhases: 4,
    noiseScale: 0.8,
    noisePower: 1.2,
    backgroundColor: 0x0B0E13,
    particleColor: 0x00FEA5,
    cameraDistance: -3,
    initialZoom: 2.10,
    finalZoom: 1.0,
    cameraNear: 1,
    cameraFar: 2.2,
    initialFar: 2.2,
    finalFar: 5.0,
    clipPlaneHeight: 0.5,
    clipPlanePosition: 0.0,
    borderWidth: 0.4,
    borderParticleCount: 2000,
    borderParticleSize: 6.80,
    borderParticleMaxSize: 6.80,
    borderParticleMinSize: 6.80,
    borderColor: 0xFFFFFF,
    thicknessVariationMultiplier: 5.0,
    greenLine: {
        width: 1.0,
        height: 0.02
    }
};

// Variables globales
let scene, camera, renderer, particles, borderParticles;
let clock;
let container;
let heightVariation = 0.12;
let lineThickness = 0.030;
let lastFrameTime = 0;
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
let targetLineOpacity = 1;
let currentLineOpacity = 1;
let planeMesh;

// Tableaux de positions
let mainInitialPositions;
let mainFinalPositions;
let positions;

// Tableaux de phases
let phaseOffsets = [0, Math.PI/2, Math.PI, Math.PI*3/2];
let frequencyMultipliers = [1, 0.5, 0.7, 0.3];
let amplitudeMultipliers = [1.5, 0.7, 0.01, 0.002];

// Pré-allocation des vecteurs et matrices pour éviter les allocations pendant l'animation
const tempVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();

// Cache pour les calculs de particules
const particleCache = {
    positions: null,
    phases: null,
    deploymentProgress: null,
    thicknessProgress: null,
    borderPhases: null,
    borderDeploymentProgress: null
};

// Cache pour les calculs fréquents
const mathCache = {
    phases: new Float32Array(config.particleCount + config.borderParticleCount),
    borderPhases: new Float32Array(config.particleCount + config.borderParticleCount)
};

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
    
    // Ajustement du pixel ratio en fonction de la taille de l'écran
    const pixelRatio = window.innerWidth <= 768 ? Math.min(window.devicePixelRatio, 2) : 1;
    
    // Scène principale
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);

    // Caméra orthographique avec frustum ajusté pour mobile
    const aspect = container.clientWidth / container.clientHeight;
    const baseWidth = 1920; // Largeur de référence
    const isMobile = window.innerWidth <= 768;
    const frustumSize = isMobile ? 
        (baseWidth / container.clientWidth) * 1.6 : // Réduit encore plus pour mobile (était 2.2)
        (baseWidth / container.clientWidth) * 3.5;  // Taille normale pour desktop
    
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

    // Renderer avec optimisations
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
    
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x0B0E13, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    renderer.physicallyCorrectLights = false;
    renderer.info.autoReset = false;
    
    container.appendChild(renderer.domElement);

    // Création des particules
    createParticles();
    
    // Mettre à jour la taille des particules
    updateParticles();
    
    // Mettre à jour l'échelle initiale des particules
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
    }
    if (borderParticles && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
    }

    // Cache les éléments de progression
    progressBar = document.querySelector('.loading-progress-bar');
    progressValue = document.querySelector('.loading-progress-value');

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
    particleCache.phases = new Float32Array(totalParticles);
    particleCache.deploymentProgress = new Float32Array(totalParticles);
    particleCache.thicknessProgress = new Float32Array(totalParticles);
    particleCache.borderPhases = new Float32Array(totalParticles);
    particleCache.borderDeploymentProgress = new Float32Array(totalParticles);
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

    if (particles) {
        // Rotation Y
        const normalizedProgress = scrollProgress / 100;
        targetRotationY = -(normalizedProgress) * (180 * Math.PI / 180);
        
        if (scrollProgress > 58) {
            const rotationProgress = (scrollProgress - 58) / 20;
            targetRotationX = -(Math.min(1, rotationProgress)) * (90 * Math.PI / 180);
        } else {
            targetRotationX = 0;
        }

        // Utilisation de Lenis pour l'interpolation
        if (window.lenis) {
            const rotationLerp = window.lenis.options.lerp;
            
            // Interpolation des rotations
            currentRotationY += (targetRotationY - currentRotationY) * rotationLerp;
            currentRotationX += (targetRotationX - currentRotationX) * rotationLerp;
            
            particles.rotation.y = currentRotationY;
            particles.rotation.x = currentRotationX;

            if (borderParticles) {
                borderParticles.rotation.copy(particles.rotation);
            }
        }

        // Gestion du zoom et de la distance de la caméra
        updateCameraParameters(scrollProgress);
    }

    // Mise à jour des particules
    if (particles && particles.geometry) {
        updateParticlesOptimized(timestamp, scrollProgress);
    }

    if (borderParticles && borderParticles.geometry) {
        updateBorderParticlesOptimized(timestamp, scrollProgress);
    }

    // Animation du plan en fonction du scroll
    updatePlaneSeparation(scrollProgress);

    // Rendu optimisé
    renderer.render(scene, camera);
}

// Nouvelle fonction pour gérer les paramètres de la caméra
function updateCameraParameters(scrollProgress) {
    if (scrollProgress < 58) {
        targetZoom = config.initialZoom;
    } else if (scrollProgress >= 58 && scrollProgress <= 78) {
        const zoomProgress = Math.min(1, (scrollProgress - 58) / 20);
        targetZoom = config.initialZoom + (config.finalZoom - config.initialZoom) * zoomProgress;
    } else {
        targetZoom = config.finalZoom;
    }

    if (scrollProgress < 23) {
        targetFar = config.initialFar;
    } else if (scrollProgress >= 23 && scrollProgress <= 50) {
        const farProgress = Math.min(1, (scrollProgress - 23) / 27);
        targetFar = config.initialFar + (config.finalFar - config.initialFar) * farProgress;
    } else {
        targetFar = config.finalFar;
    }

    if (window.lenis) {
        const lerpFactor = window.lenis.options.lerp * 0.8;
        
        currentZoom += (targetZoom - currentZoom) * lerpFactor;
        currentFar += (targetFar - currentFar) * lerpFactor;
        
        camera.zoom = currentZoom;
        camera.far = currentFar;
        camera.near = Math.max(0.1, currentFar * 0.1);
        camera.updateProjectionMatrix();
    }
}

// Nouvelle fonction pour gérer l'animation du plan de séparation
function updatePlaneSeparation(scrollProgress) {
    if (scrollProgress <= 32) {
        config.clipPlaneHeight = 0.5;
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 1;
    } else if (scrollProgress <= 40) {
        const progress = (scrollProgress - 32) / 8;
        config.clipPlaneHeight = 0.5 - (progress * 0.1);
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 1;
    } else if (scrollProgress <= 46) {
        config.clipPlaneHeight = 0.4;
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 1;
    } else if (scrollProgress <= 68) {
        const heightProgress = (scrollProgress - 46) / 22;
        const opacityProgress = (scrollProgress - 46) / 14;
        targetLineOpacity = Math.max(0, 1 - opacityProgress);
        config.clipPlaneHeight = 0.4 + (heightProgress * 0.6);
        config.clipPlanePosition = 0.5;
    } else {
        config.clipPlaneHeight = 1.0;
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 0;
    }

    updateClipPlane();

    if (planeMesh && window.lenis) {
        const lerpFactor = window.lenis.options.lerp;
        const worldY = (config.clipPlanePosition - config.clipPlaneHeight) * 2;
        
        planeMesh.position.y += (worldY - planeMesh.position.y) * lerpFactor;
        currentLineOpacity += (targetLineOpacity - currentLineOpacity) * lerpFactor;
        
        // Mise à jour des uniforms
        if (particles && particles.material.uniforms) {
            particles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
            particles.material.uniforms.clipPlanePosition.value = planeMesh.position.y / 2;
        }
        
        if (borderParticles && borderParticles.material.uniforms) {
            borderParticles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
            borderParticles.material.uniforms.clipPlanePosition.value = planeMesh.position.y / 2;
        }
        
        // Mise à jour de l'échelle et de l'opacité
        const scaleCompensation = config.initialZoom / camera.zoom;
        const circleDiameter = config.radius * 2;
        const targetWidth = circleDiameter * config.greenLine.width;
        
        planeMesh.scale.set(targetWidth * scaleCompensation, 1, 1);
        planeMesh.material.opacity = currentLineOpacity;
        planeMesh.visible = currentLineOpacity > 0.001;
    }
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
    
    // Calculer les valeurs cibles en fonction du scroll
    const isDeploying = scrollProgress >= 60;
    const deploymentProgress = isDeploying ? (scrollProgress - 60) / 30 : 0;
    const targetDeployment = Math.min(1, deploymentProgress);
    
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

            // Interpolation des progressions avec Lenis
            particleCache.borderDeploymentProgress[i] += (targetDeployment - particleCache.borderDeploymentProgress[i]) * deploymentLerp;

            const currentDeployment = particleCache.borderDeploymentProgress[i];

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
                radialOffset = currentDeployment * 0.05 * radialDirection;
            } else {
                // Pour les particules allant vers l'intérieur (radialDirection = -1) ou restant sur place (radialDirection = 0)
                radialOffset = currentDeployment * 0.08 * radialDirection;
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
    const startPoint = windowHeight * 0.9;
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
    const radialOffsets = new Float32Array(config.particleCount);

    // Valeurs fixes pour la continuité
    const startValues = new Float32Array(config.curvePhases);
    const endValues = new Float32Array(config.curvePhases);
    for (let phase = 0; phase < config.curvePhases; phase++) {
        startValues[phase] = Math.sin(0 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]) || 0;
        endValues[phase] = Math.sin(Math.PI * 2 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]) || 0;
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
        const randomFactor = Math.max(0.8, Math.min(1.2, 0.8 + Math.random() * 0.4));
        const layerOffset = Math.max(-0.04, Math.min(0.04, (randomFactor - 1) * 0.04));
        
        // État initial : toutes les particules presque sur le cercle de base
        const initialRadius = Math.max(0.1, config.radius * (1 + layerOffset * 0.2));
        
        // État final : variation radiale légèrement plus prononcée
        const finalRadius = Math.max(0.1, config.radius * (1 + layerOffset));

        // Positions initiales (quasi-régulières sur le cercle)
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;

        // Positions finales (légèrement plus variées)
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;

        // Calcul de la hauteur Y avec distribution contrôlée
        const thicknessVariation = Math.max(0, Math.min(1, (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.5))); // Réduit de 0.6 à 0.5
        const baseThickness = Math.max(0.001, lineThickness * (1 + thicknessVariation));
        const randomY = (Math.random() * 2 - 1) * baseThickness * 0.9; // Ajout d'un facteur de réduction 0.9
        let y = randomY;
        
        // Ajout des variations de hauteur de manière plus régulière
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * (frequencyMultipliers[phase] || 1);
            const amp = heightVariation * (amplitudeMultipliers[phase] || 1) * 0.9; // Ajout d'un facteur de réduction 0.9
            
            let value = Math.sin(finalAngle * freq + (phaseOffsets[phase] || 0)) || 0;
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + (startValues[phase] || 0) * blend;
            }
            
            y += (value * amp) || 0;
        }

        // Ajout du bruit avec une influence réduite
        const noiseValue = (noise1D(finalAngle * config.noiseScale) || 0) * 0.18 + (Math.random() - 0.5) * 0.08; // Réduit de 0.2 à 0.18 et de 0.1 à 0.08
        y += (noiseValue * heightVariation) || 0;

        // S'assurer que y est un nombre valide
        y = Math.max(-10, Math.min(10, y || 0));

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
        const randomFactor = Math.max(0.8, Math.min(1.2, 0.8 + Math.random() * 0.4));
        const layerOffset = Math.max(-0.04, Math.min(0.04, (randomFactor - 1) * 0.04));
        
        // État initial : toutes les particules presque sur le cercle de base
        const initialRadius = Math.max(0.1, config.radius * (1 + layerOffset * 0.2));
        
        // État final : variation radiale légèrement plus prononcée
        const finalRadius = Math.max(0.1, config.radius * (1 + layerOffset));

        // Positions initiales (quasi-régulières sur le cercle)
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;

        // Positions finales (légèrement plus variées)
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;

        // Calcul de la hauteur Y avec distribution contrôlée
        const thicknessVariation = Math.max(0, Math.min(1, (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.6)));
        const baseThickness = Math.max(0.001, lineThickness * (1 + thicknessVariation));
        const randomY = (Math.random() * 2 - 1) * baseThickness;
        let y = randomY;
        
        // Ajout des variations de hauteur de manière plus régulière
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * (frequencyMultipliers[phase] || 1);
            const amp = heightVariation * (amplitudeMultipliers[phase] || 1);
            
            let value = Math.sin(finalAngle * freq + (phaseOffsets[phase] || 0)) || 0;
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + (startValues[phase] || 0) * blend;
            }
            
            y += (value * amp) || 0;
        }

        // Distribution extrême pour certaines particules
        const rand = Math.random();
        if (rand < 0.3) { // 30% des particules vers le bas
            y -= (Math.random() * 0.6 + 0.2) * heightVariation * 1.0; // Réduit de 0.8 à 0.6 et de 1.3 à 1.0
        } else if (rand < 0.6) { // 30% des particules vers le haut
            y += (Math.random() * 0.6 + 0.2) * heightVariation * 1.0; // Réduit de 0.8 à 0.6 et de 1.3 à 1.0
        }

        // Ajout d'une variation aléatoire standard pour toutes les particules
        y += (Math.random() * 2 - 1) * heightVariation * 0.4; // Réduit de 0.6 à 0.4

        // Ajout du bruit avec variation ajustée
        const noiseValue = Math.sin(finalAngle * config.noiseScale) * 0.25; // Réduit de 0.3 à 0.25
        y += noiseValue * (heightVariation * 0.9); // Réduit de 1.2 à 0.9

        // Distribution secondaire pour plus de variété mais plus resserrée
        if (Math.random() < 0.4) { // 40% des particules
            const direction = Math.random() < 0.5 ? 1 : -1;
            y += direction * Math.random() * heightVariation * 0.3; // Réduit de 0.4 à 0.3
        }

        // Ajout d'une légère attraction vers les courbes principales
        const attractionStrength = 0.15; // Force d'attraction vers le centre
        y *= (1 - attractionStrength);

        // S'assurer que y est un nombre valide
        y = Math.max(-10, Math.min(10, y || 0));

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
            scaleFactor: { value: container ? container.clientWidth / 1920 : 1.0 },
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
            
            attribute float phase;
            
            varying vec4 vClipPos;
            varying float vY;
            
            // Fonction pour s'assurer qu'une valeur n'est pas NaN
            float safeValue(float value) {
                return isnan(value) ? 0.0 : value;
            }
            
            void main() {
                // Position de base sécurisée
                vec3 basePosition = vec3(
                    safeValue(position.x),
                    safeValue(position.y),
                    safeValue(position.z)
                );
                
                // Calcul sécurisé du flottement
                float safePhase = safeValue(phase);
                float safeTime = safeValue(time);
                
                // Limiter les amplitudes pour éviter les valeurs extrêmes
                float offsetX = sin(safeTime * 0.5 + safePhase) * 0.015;
                float offsetY = cos(safeTime * 0.4 + safePhase) * 0.015;
                float offsetZ = sin(safeTime * 0.6 + safePhase) * 0.015;
                
                // Appliquer les offsets de manière sécurisée
                vec3 finalPosition = basePosition + vec3(
                    clamp(offsetX, -0.015, 0.015),
                    clamp(offsetY, -0.015, 0.015),
                    clamp(offsetZ, -0.015, 0.015)
                );
                
                // S'assurer que la position finale est valide
                finalPosition = vec3(
                    safeValue(finalPosition.x),
                    safeValue(finalPosition.y),
                    safeValue(finalPosition.z)
                );
                
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
                
                // Définir les couleurs de base
                vec3 whiteColor = vec3(1.0);
                vec3 greenColor = vec3(0.0, 254.0/255.0, 165.0/255.0);
                
                // Utiliser la position Y de la ligne comme seuil, en ajustant l'espace de coordonnées
                vec3 color = vY > clipPlanePosition * 2.0 ? greenColor : whiteColor;
                
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
        const radialOffset = Math.random() * config.borderWidth * 0.7; // Réduit de 1.0 à 0.7
        
        // Calcul de la position Y basée sur les courbes (avec amplitude réduite)
        let baseY = 0;
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * frequencyMultipliers[phase];
            const amp = heightVariation * amplitudeMultipliers[phase] * 1.2;
            
            let value = Math.sin(angle * freq + phaseOffsets[phase]);
            
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + startValues[phase] * blend;
            }
            
            baseY += value * amp;
        }

        // Distribution extrême pour certaines particules
        const rand = Math.random();
        if (rand < 0.3) { // 30% des particules vers le bas
            baseY -= (Math.random() * 0.6 + 0.2) * heightVariation * 1.0;
        } else if (rand < 0.6) { // 30% des particules vers le haut
            baseY += (Math.random() * 0.6 + 0.2) * heightVariation * 1.0;
        }

        // Ajout d'une variation aléatoire standard pour toutes les particules
        baseY += (Math.random() * 2 - 1) * heightVariation * 0.4;

        // Ajout du bruit avec variation ajustée
        const noiseValue = Math.sin(angle * config.noiseScale) * 0.25;
        baseY += noiseValue * (heightVariation * 0.9);

        // Distribution secondaire pour plus de variété mais plus resserrée
        if (Math.random() < 0.4) { // 40% des particules
            const direction = Math.random() < 0.5 ? 1 : -1;
            baseY += direction * Math.random() * heightVariation * 0.3;
        }

        // Ajout d'une légère attraction vers les courbes principales
        const attractionStrength = 0.15;
        baseY *= (1 - attractionStrength);

        // Calcul de la position de base sur le cercle
        const baseRadius = config.radius + ((i % 3) - 1) * lineThickness;
        const baseX = Math.cos(angle) * baseRadius;
        const baseZ = Math.sin(angle) * baseRadius;

        // Calcul des offsets pour la position finale avec amplitude réduite
        const offsetX = Math.cos(radialAngle) * radialOffset * 0.7;
        const offsetY = (Math.random() - 0.5) * config.borderWidth * 0.7;
        const offsetZ = Math.sin(radialAngle) * radialOffset * 0.7;

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
            
            attribute float phase;
            
            varying vec4 vClipPos;
            varying float vY;
            
            // Fonction pour s'assurer qu'une valeur n'est pas NaN
            float safeValue(float value) {
                return isnan(value) ? 0.0 : value;
            }
            
            void main() {
                // Position de base sécurisée
                vec3 basePosition = vec3(
                    safeValue(position.x),
                    safeValue(position.y),
                    safeValue(position.z)
                );
                
                // Calcul sécurisé du flottement
                float safePhase = safeValue(phase);
                float safeTime = safeValue(time);
                
                // Limiter les amplitudes pour éviter les valeurs extrêmes
                float offsetX = sin(safeTime * 0.5 + safePhase) * 0.015;
                float offsetY = cos(safeTime * 0.4 + safePhase) * 0.015;
                float offsetZ = sin(safeTime * 0.6 + safePhase) * 0.015;
                
                // Appliquer les offsets de manière sécurisée
                vec3 finalPosition = basePosition + vec3(
                    clamp(offsetX, -0.015, 0.015),
                    clamp(offsetY, -0.015, 0.015),
                    clamp(offsetZ, -0.015, 0.015)
                );
                
                // S'assurer que la position finale est valide
                finalPosition = vec3(
                    safeValue(finalPosition.x),
                    safeValue(finalPosition.y),
                    safeValue(finalPosition.z)
                );
                
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
                
                // Définir les couleurs de base
                vec3 whiteColor = vec3(1.0);
                vec3 greenColor = vec3(0.0, 254.0/255.0, 165.0/255.0);
                
                // Utiliser la position Y de la ligne comme seuil, en ajustant l'espace de coordonnées
                vec3 color = vY > clipPlanePosition * 2.0 ? greenColor : whiteColor;
                
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
    const isMobile = window.innerWidth <= 768;
    const frustumSize = isMobile ? 
        (baseWidth / container.clientWidth) * 1.6 : // Réduit encore plus pour mobile (était 2.2)
        (baseWidth / container.clientWidth) * 3.5;  // Taille normale pour desktop
    
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    
    // Mettre à jour l'échelle des particules avec un facteur plus grand sur mobile
    const scaleFactor = container.clientWidth / baseWidth * (isMobile ? 1.5 : 1.0);
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.scaleFactor.value = scaleFactor;
        particles.material.uniforms.pointSize.value = config.particleSize * (isMobile ? 1.2 : 1.0);
    }
    if (borderParticles && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.scaleFactor.value = scaleFactor;
        borderParticles.material.uniforms.pointSize.value = config.borderParticleSize * (isMobile ? 1.2 : 1.0);
    }
    
    // Ajuster le pixel ratio pour mobile
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 2) : 1;
    renderer.setPixelRatio(pixelRatio);
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
    const totalHeight = airdropRect.height - windowHeight;
    const currentScroll = -airdropRect.top;
    const scrollAtStart = -startPoint;
    
    const adjustedScroll = currentScroll - scrollAtStart;
    const adjustedTotal = totalHeight - scrollAtStart;
    const scrollProgress = Math.min(100, Math.max(0, (adjustedScroll / adjustedTotal) * 100));

    // Animation des rotations
    if (particles) {
        // Rotation Y
        const rotationY = -(scrollProgress / 100) * (180 * Math.PI / 180);
        particles.rotation.y = rotationY;

        // Rotation X (60% à 84%)
        if (scrollProgress > 60) {
            const rotationProgress = Math.min(1, (scrollProgress - 60) / 24);
            particles.rotation.x = -(rotationProgress) * (90 * Math.PI / 180);
        } else {
            particles.rotation.x = 0;
        }

        if (borderParticles) {
            borderParticles.rotation.copy(particles.rotation);
        }
    }

    // Animation du plan en fonction du scroll
    if (scrollProgress <= 32) {
        // De 0 à 32% : maintient 50% de hauteur
        config.clipPlaneHeight = 0.5;
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 1;
        
    } else if (scrollProgress <= 40) {
        // De 32% à 40% : réduction à 40% de hauteur
        const progress = (scrollProgress - 32) / 8;
        config.clipPlaneHeight = 0.5 - (progress * 0.1); // De 50% à 40%
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 1;
        
    } else if (scrollProgress <= 46) {
        // De 40% à 46% : maintient 40% de hauteur
        config.clipPlaneHeight = 0.4;
        config.clipPlanePosition = 0.5;
        targetLineOpacity = 1;
        
    } else if (scrollProgress <= 68) {
        // De 46% à 68% : changement de hauteur et fade out de la ligne
        const heightProgress = (scrollProgress - 46) / 22; // Garde la même progression pour la hauteur
        const opacityProgress = (scrollProgress - 46) / 14; // Nouveau calcul pour que l'opacité atteigne 0 à 60%
        targetLineOpacity = Math.max(0, 1 - opacityProgress);
        config.clipPlaneHeight = 0.4 + (heightProgress * 0.6); // La hauteur continue jusqu'à 68%
        config.clipPlanePosition = 0.5; // Maintient la position à 0.5
        
    } else {
        // Au-delà de 68% : maintient 100% et ligne invisible
        config.clipPlaneHeight = 1.0;
        config.clipPlanePosition = 0.5; // Maintient la position à 0.5
        targetLineOpacity = 0;
    }

    // Mettre à jour les uniforms du plan
    updateClipPlane();
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
        heightVariation = value;
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
