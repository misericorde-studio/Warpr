import * as THREE from 'three';
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
let isScrolling = false;
let scrollTimeout;
let lastScrollY = 0;
let mainInitialPositions;
let mainFinalPositions;
let positions;
let phaseOffsets = [0, Math.PI/2, Math.PI, Math.PI*3/2];
let frequencyMultipliers = [1, 0.5, 0.7, 0.3];
let amplitudeMultipliers = [1.5, 0.7, 0.01, 0.002];
const tempVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();
const particleCache = {
    positions: null,
    phases: null,
    deploymentProgress: null,
    thicknessProgress: null,
    borderPhases: null,
    borderDeploymentProgress: null
};
const mathCache = {
    phases: new Float32Array(config.particleCount + config.borderParticleCount),
    borderPhases: new Float32Array(config.particleCount + config.borderParticleCount)
};
for (let i = 0; i < config.particleCount + config.borderParticleCount; i++) {
    mathCache.phases[i] = Math.random() * Math.PI * 2;
    mathCache.borderPhases[i] = Math.random() * Math.PI * 2;
}
function createOptimizedGeometry(particleCount) {
    const positions = new Float32Array(particleCount * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.attributes.position.usage = THREE.DynamicDrawUsage;
    return geometry;
}
function noise1D(x) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const fadeX = x * x * (3 - 2 * x);
    const h1 = Math.sin(X * 12.9898) * 43758.5453123;
    const h2 = Math.sin((X + 1) * 12.9898) * 43758.5453123;
    return lerp(h1 - Math.floor(h1), h2 - Math.floor(h2), fadeX);
}
function lerp(a, b, t) {
    return a + t * (b - a);
}
function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function init() {
    container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    visibilityObserver = createObserver(container);
    const pixelRatio = window.innerWidth <= 768 ? Math.min(window.devicePixelRatio, 2) : 1;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    const aspect = container.clientWidth / container.clientHeight;
    const baseWidth = 1920;
    const isMobile = window.innerWidth <= 768;
    const frustumSize = isMobile ? 
        (baseWidth / container.clientWidth) * 1.6 :
        (baseWidth / container.clientWidth) * 3.5;
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        config.cameraNear,
        config.cameraFar
    );
    camera.position.set(0, 0, config.cameraDistance);
    camera.lookAt(0, 0, 0);
    camera.zoom = config.initialZoom;
    camera.updateProjectionMatrix();
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
    createParticles();
    updateParticles();
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
    }
    if (borderParticles && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.scaleFactor.value = container.clientWidth / baseWidth;
    }
    progressBar = document.querySelector('.loading-progress-bar');
    progressValue = document.querySelector('.loading-progress-value');
    prewarmObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasPrewarmed) {
                prewarmRenderer();
                hasPrewarmed = true;
            }
        });
    }, {
        rootMargin: '100px 0px',
        threshold: 0
    });
    prewarmObserver.observe(container);
    clock = new THREE.Clock();
    window.addEventListener('resize', throttle(onWindowResize, 100), false);
    window.addEventListener('scroll', throttle(updateScroll, 16), { passive: true });
    window.addEventListener('scroll', function() {
        if (!isScrolling) {
            isScrolling = true;
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
            isScrolling = false;
        }, 150);
    }, { passive: true });
    lastFrameTime = performance.now();
    animate(lastFrameTime);
    const thresholdLineGeometry = new THREE.BufferGeometry();
    const lineWidth = 1;
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
    planeMesh = thresholdLine;
    initializeParticleCache();
    currentZoom = config.initialZoom;
    targetZoom = config.initialZoom;
    currentFar = config.initialFar;
    targetFar = config.initialFar;
    camera.zoom = currentZoom;
    camera.far = currentFar;
    camera.near = Math.max(0.1, currentFar * 0.1);
    camera.updateProjectionMatrix();
}
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
function animate(timestamp) {
    requestAnimationFrame(animate);
    if (window.lenis && (timestamp - lastFrameTime >= 16)) {
        window.lenis.raf(timestamp);
    }
    if (timestamp - lastFrameTime < 15.5) {
        return;
    }
    lastFrameTime = timestamp;
    const scrollProgress = calculateScrollProgress();
    updateProgressIndicator(scrollProgress);
    if (particles) {
        const normalizedProgress = scrollProgress / 100;
        targetRotationY = -(normalizedProgress) * (180 * Math.PI / 180);
        if (scrollProgress > 58) {
            const rotationProgress = (scrollProgress - 58) / 20;
            targetRotationX = -(Math.min(1, rotationProgress)) * (90 * Math.PI / 180);
        } else {
            targetRotationX = 0;
        }
        if (window.lenis) {
            const rotationLerp = window.lenis.options.lerp;
            currentRotationY += (targetRotationY - currentRotationY) * rotationLerp;
            currentRotationX += (targetRotationX - currentRotationX) * rotationLerp;
            particles.rotation.y = currentRotationY;
            particles.rotation.x = currentRotationX;
            if (borderParticles) {
                borderParticles.rotation.copy(particles.rotation);
            }
        }
        updateCameraParameters(scrollProgress);
    }
    if (particles && particles.geometry) {
        updateParticlesOptimized(timestamp, scrollProgress);
    }
    if (borderParticles && borderParticles.geometry) {
        updateBorderParticlesOptimized(timestamp, scrollProgress);
    }
    updatePlaneSeparation(scrollProgress);
    renderer.render(scene, camera);
}
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
        if (particles && particles.material.uniforms) {
            particles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
            particles.material.uniforms.clipPlanePosition.value = planeMesh.position.y / 2;
        }
        if (borderParticles && borderParticles.material.uniforms) {
            borderParticles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
            borderParticles.material.uniforms.clipPlanePosition.value = planeMesh.position.y / 2;
        }
        const scaleCompensation = config.initialZoom / camera.zoom;
        const circleDiameter = config.radius * 2;
        const targetWidth = circleDiameter * config.greenLine.width;
        planeMesh.scale.set(targetWidth * scaleCompensation, 1, 1);
        planeMesh.material.opacity = currentLineOpacity;
        planeMesh.visible = currentLineOpacity > 0.001;
    }
}
function updateBorderParticlesOptimized(timestamp, scrollProgress) {
    const positions = borderParticles.geometry.attributes.position.array;
    const initialPositions = borderParticles.geometry.attributes.initialPosition.array;
    const finalPositions = borderParticles.geometry.attributes.finalPosition.array;
    const time = timestamp * 0.001;
    const batchSize = 1000;
    const totalParticles = positions.length / 3;
    const deploymentLerp = window.lenis ? window.lenis.options.lerp : 0.1;
    if (!particleCache.borderPhases) {
        particleCache.borderPhases = new Float32Array(totalParticles);
        for (let i = 0; i < totalParticles; i++) {
            particleCache.borderPhases[i] = Math.random() * Math.PI * 2;
        }
    }
    if (!particleCache.borderDeploymentProgress) {
        particleCache.borderDeploymentProgress = new Float32Array(totalParticles);
    }
    const isDeploying = scrollProgress >= 60;
    const deploymentProgress = isDeploying ? (scrollProgress - 60) / 30 : 0;
    const targetDeployment = Math.min(1, deploymentProgress);
    for (let batch = 0; batch < totalParticles; batch += batchSize) {
        const end = Math.min(batch + batchSize, totalParticles);
        for (let i = batch; i < end; i++) {
            const i3 = i * 3;
            const phase = particleCache.borderPhases[i];
            const floatX = Math.sin(time * 1.5 + phase) * 0.015;
            const floatY = Math.cos(time * 1.8 + phase) * 0.015;
            const floatZ = Math.sin(time * 2.0 + phase) * 0.015;
            let baseX = initialPositions[i3];
            let baseZ = initialPositions[i3 + 2];
            if (particleCache.borderDeploymentProgress[i] === undefined) {
                particleCache.borderDeploymentProgress[i] = 0;
            }
            particleCache.borderDeploymentProgress[i] += (targetDeployment - particleCache.borderDeploymentProgress[i]) * deploymentLerp;
            const currentDeployment = particleCache.borderDeploymentProgress[i];
            const deployedX = initialPositions[i3] + (finalPositions[i3] - initialPositions[i3]) * currentDeployment;
            const deployedZ = initialPositions[i3 + 2] + (finalPositions[i3 + 2] - initialPositions[i3 + 2]) * currentDeployment;
            const dx = deployedX;
            const dz = deployedZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const dirX = dx / dist;
            const dirZ = dz / dist;
            const radialDirection = ((i % 3) - 1);
            let radialOffset;
            if (radialDirection > 0) {
                radialOffset = currentDeployment * 0.05 * radialDirection;
            } else {
                radialOffset = currentDeployment * 0.08 * radialDirection;
            }
            baseX = deployedX + dirX * radialOffset;
            baseZ = deployedZ + dirZ * radialOffset;
            positions[i3] = baseX + floatX;
            positions[i3 + 1] = initialPositions[i3 + 1] + floatY;
            positions[i3 + 2] = baseZ + floatZ;
        }
    }
    borderParticles.geometry.attributes.position.needsUpdate = true;
}
function updateParticlesOptimized(timestamp, scrollProgress) {
    const positions = particles.geometry.attributes.position.array;
    const initialPositions = particles.geometry.attributes.initialPosition.array;
    const finalPositions = particles.geometry.attributes.finalPosition.array;
    const radialOffsets = particles.geometry.attributes.radialOffset.array;
    const time = timestamp * 0.001;
    const batchSize = 1000;
    const totalParticles = positions.length / 3;
    const deploymentLerp = window.lenis ? window.lenis.options.lerp : 0.1;
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
    const isDeploying = scrollProgress >= 60;
    const deploymentProgress = isDeploying ? (scrollProgress - 60) / 30 : 0;
    const targetDeployment = Math.min(1, deploymentProgress);
    const targetThickness = isDeploying ? Math.min(0.1, deploymentProgress * 0.1) : 0;
    for (let batch = 0; batch < totalParticles; batch += batchSize) {
        const end = Math.min(batch + batchSize, totalParticles);
        for (let i = batch; i < end; i++) {
            const i3 = i * 3;
            if (!particleCache.phases[i]) {
                particleCache.phases[i] = Math.random() * Math.PI * 2;
            }
            const phase = particleCache.phases[i];
            const floatX = Math.sin(time * 1.5 + phase) * 0.015;
            const floatY = Math.cos(time * 1.8 + phase) * 0.015;
            const floatZ = Math.sin(time * 2.0 + phase) * 0.015;
            let baseX = initialPositions[i3];
            let baseZ = initialPositions[i3 + 2];
            if (particleCache.deploymentProgress[i] === undefined) {
                particleCache.deploymentProgress[i] = 0;
            }
            if (particleCache.thicknessProgress[i] === undefined) {
                particleCache.thicknessProgress[i] = 0;
            }
            particleCache.deploymentProgress[i] += (targetDeployment - particleCache.deploymentProgress[i]) * deploymentLerp;
            particleCache.thicknessProgress[i] += (targetThickness - particleCache.thicknessProgress[i]) * deploymentLerp;
            const currentDeployment = particleCache.deploymentProgress[i];
            const currentThickness = particleCache.thicknessProgress[i];
            const deployedX = initialPositions[i3] + (finalPositions[i3] - initialPositions[i3]) * currentDeployment;
            const deployedZ = initialPositions[i3 + 2] + (finalPositions[i3 + 2] - initialPositions[i3 + 2]) * currentDeployment;
            const dx = deployedX;
            const dz = deployedZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const dirX = dx / dist;
            const dirZ = dz / dist;
            const radialOffset = radialOffsets[i] * currentThickness;
            baseX = deployedX + dirX * radialOffset;
            baseZ = deployedZ + dirZ * radialOffset;
            positions[i3] = baseX + floatX;
            positions[i3 + 1] = initialPositions[i3 + 1] + floatY;
            positions[i3 + 2] = baseZ + floatZ;
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;
}
function calculateScrollProgress() {
    const investorSection = document.querySelector('.investor');
    const investorRect = investorSection.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const startPoint = windowHeight * 0.9;
    const sectionTop = investorRect.top;
    if (sectionTop > startPoint || investorRect.bottom <= 0) {
        return 0;
    }
    const totalHeight = investorRect.height - windowHeight;
    const currentScroll = -investorRect.top;
    const scrollAtStart = -startPoint;
    const adjustedScroll = currentScroll - scrollAtStart;
    const adjustedTotal = totalHeight - scrollAtStart;
    return Math.min(100, Math.max(0, Math.round((adjustedScroll / adjustedTotal) * 100)));
}
function prewarmRenderer() {
    const currentScrollProgress = window.scrollY;
    const testScrollPositions = [0, 30, 60, 90, 100];
    testScrollPositions.forEach(scrollProgress => {
        if (particles) {
            const rotationY = -(scrollProgress / 100) * (180 * Math.PI / 180);
            particles.rotation.y = rotationY;
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
        renderer.render(scene, camera);
    });
    if (particles) {
        particles.rotation.set(0, 0, 0);
        if (borderParticles) {
            borderParticles.rotation.set(0, 0, 0);
        }
    }
}
function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const colors = new Float32Array(config.particleCount * 3);
    const mainInitialPositions = new Float32Array(config.particleCount * 3);
    const mainFinalPositions = new Float32Array(config.particleCount * 3);
    const radialOffsets = new Float32Array(config.particleCount);
    const startValues = new Float32Array(config.curvePhases);
    const endValues = new Float32Array(config.curvePhases);
    for (let phase = 0; phase < config.curvePhases; phase++) {
        startValues[phase] = Math.sin(0 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]) || 0;
        endValues[phase] = Math.sin(Math.PI * 2 * config.curveFrequency * frequencyMultipliers[phase] + phaseOffsets[phase]) || 0;
    }
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.particleCount) * Math.PI * 2;
        const progress = i / (config.particleCount - 1);
        const angleVariation = (Math.random() - 0.5) * 0.02;
        const finalAngle = angle + angleVariation;
        const randomFactor = Math.max(0.8, Math.min(1.2, 0.8 + Math.random() * 0.4));
        const layerOffset = Math.max(-0.04, Math.min(0.04, (randomFactor - 1) * 0.04));
        const initialRadius = Math.max(0.1, config.radius * (1 + layerOffset * 0.2));
        const finalRadius = Math.max(0.1, config.radius * (1 + layerOffset));
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;
        const thicknessVariation = Math.max(0, Math.min(1, (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.5)));
        const baseThickness = Math.max(0.001, lineThickness * (1 + thicknessVariation));
        const randomY = (Math.random() * 2 - 1) * baseThickness * 0.9;
        let y = randomY;
        for (let phase = 0; phase < config.curvePhases; phase++) {
            const freq = config.curveFrequency * (frequencyMultipliers[phase] || 1);
            const amp = heightVariation * (amplitudeMultipliers[phase] || 1) * 0.9;
            let value = Math.sin(finalAngle * freq + (phaseOffsets[phase] || 0)) || 0;
            if (progress > 0.95) {
                const blend = (progress - 0.95) / 0.05;
                value = value * (1 - blend) + (startValues[phase] || 0) * blend;
            }
            y += (value * amp) || 0;
        }
        const noiseValue = (noise1D(finalAngle * config.noiseScale) || 0) * 0.18 + (Math.random() - 0.5) * 0.08;
        y += (noiseValue * heightVariation) || 0;
        y = Math.max(-10, Math.min(10, y || 0));
        maxY = Math.max(maxY, y);
        minY = Math.min(minY, y);
        radialOffsets[i] = Math.random() * 2 - 1;
    }
    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.particleCount) * Math.PI * 2;
        const progress = i / (config.particleCount - 1);
        const angleVariation = (Math.random() - 0.5) * 0.02;
        const finalAngle = angle + angleVariation;
        const randomFactor = Math.max(0.8, Math.min(1.2, 0.8 + Math.random() * 0.4));
        const layerOffset = Math.max(-0.04, Math.min(0.04, (randomFactor - 1) * 0.04));
        const initialRadius = Math.max(0.1, config.radius * (1 + layerOffset * 0.2));
        const finalRadius = Math.max(0.1, config.radius * (1 + layerOffset));
        const initialX = Math.cos(finalAngle) * initialRadius;
        const initialZ = Math.sin(finalAngle) * initialRadius;
        const finalX = Math.cos(finalAngle) * finalRadius;
        const finalZ = Math.sin(finalAngle) * finalRadius;
        const thicknessVariation = Math.max(0, Math.min(1, (Math.abs(Math.cos(finalAngle * 2)) + Math.abs(Math.sin(finalAngle * 3))) * (config.thicknessVariationMultiplier * 0.6)));
        const baseThickness = Math.max(0.001, lineThickness * (1 + thicknessVariation));
        const randomY = (Math.random() * 2 - 1) * baseThickness;
        let y = randomY;
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
        const rand = Math.random();
        if (rand < 0.3) {
            y -= (Math.random() * 0.6 + 0.2) * heightVariation * 1.0;
        } else if (rand < 0.6) {
            y += (Math.random() * 0.6 + 0.2) * heightVariation * 1.0;
        }
        y += (Math.random() * 2 - 1) * heightVariation * 0.4;
        const noiseValue = Math.sin(finalAngle * config.noiseScale) * 0.25;
        y += noiseValue * (heightVariation * 0.9);
        if (Math.random() < 0.4) {
            const direction = Math.random() < 0.5 ? 1 : -1;
            y += direction * Math.random() * heightVariation * 0.3;
        }
        const attractionStrength = 0.15;
        y *= (1 - attractionStrength);
        y = Math.max(-10, Math.min(10, y || 0));
        const normalizedHeight = (y - minY) / (maxY - minY);
        if (normalizedHeight > config.greenThreshold) {
            colors[i3] = 0.0;
            colors[i3 + 1] = 0.996;
            colors[i3 + 2] = 0.647;
        } else {
            colors[i3] = 1.0;
            colors[i3 + 1] = 1.0;
            colors[i3 + 2] = 1.0;
        }
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
            float safeValue(float value) {
                return isnan(value) ? 0.0 : value;
            }
            void main() {
                vec3 basePosition = vec3(
                    safeValue(position.x),
                    safeValue(position.y),
                    safeValue(position.z)
                );
                float safePhase = safeValue(phase);
                float safeTime = safeValue(time);
                float offsetX = sin(safeTime * 0.5 + safePhase) * 0.015;
                float offsetY = cos(safeTime * 0.4 + safePhase) * 0.015;
                float offsetZ = sin(safeTime * 0.6 + safePhase) * 0.015;
                vec3 finalPosition = basePosition + vec3(
                    clamp(offsetX, -0.015, 0.015),
                    clamp(offsetY, -0.015, 0.015),
                    clamp(offsetZ, -0.015, 0.015)
                );
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
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                float r = dot(cxy, cxy);
                float delta = fwidth(r);
                float alpha = 1.0 - smoothstep(1.0 - delta, 1.0, r);
                if (alpha <= 0.0) {
                    discard;
                }
                vec3 whiteColor = vec3(1.0);
                vec3 greenColor = vec3(0.0, 254.0/255.0, 165.0/255.0);
                vec3 color = vY > clipPlanePosition * 2.0 ? greenColor : whiteColor;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false
    });
    particles = new THREE.Points(geometry, material);
    particles.frustumCulled = true;
    scene.add(particles);
    const borderGeometry = new THREE.BufferGeometry();
    const borderPositions = new Float32Array(config.borderParticleCount * 3);
    const borderSizes = new Float32Array(config.borderParticleCount);
    const borderInitialPositions = new Float32Array(config.borderParticleCount * 3);
    const borderFinalPositions = new Float32Array(config.borderParticleCount * 3);
    for (let i = 0; i < config.borderParticleCount; i++) {
        const i3 = i * 3;
        const angle = (i / config.borderParticleCount) * Math.PI * 2;
        const progress = i / (config.borderParticleCount - 1);
        const radialAngle = Math.random() * Math.PI * 2;
        const radialOffset = Math.random() * config.borderWidth * 0.7;
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
        const rand = Math.random();
        if (rand < 0.3) {
            baseY -= (Math.random() * 0.6 + 0.2) * heightVariation * 1.0;
        } else if (rand < 0.6) {
            baseY += (Math.random() * 0.6 + 0.2) * heightVariation * 1.0;
        }
        baseY += (Math.random() * 2 - 1) * heightVariation * 0.4;
        const noiseValue = Math.sin(angle * config.noiseScale) * 0.25;
        baseY += noiseValue * (heightVariation * 0.9);
        if (Math.random() < 0.4) {
            const direction = Math.random() < 0.5 ? 1 : -1;
            baseY += direction * Math.random() * heightVariation * 0.3;
        }
        const attractionStrength = 0.15;
        baseY *= (1 - attractionStrength);
        const baseRadius = config.radius + ((i % 3) - 1) * lineThickness;
        const baseX = Math.cos(angle) * baseRadius;
        const baseZ = Math.sin(angle) * baseRadius;
        const offsetX = Math.cos(radialAngle) * radialOffset * 0.7;
        const offsetY = (Math.random() - 0.5) * config.borderWidth * 0.7;
        const offsetZ = Math.sin(radialAngle) * radialOffset * 0.7;
        borderInitialPositions[i3] = baseX;
        borderInitialPositions[i3 + 1] = baseY;
        borderInitialPositions[i3 + 2] = baseZ;
        borderFinalPositions[i3] = baseX + offsetX;
        borderFinalPositions[i3 + 1] = baseY;
        borderFinalPositions[i3 + 2] = baseZ + offsetZ;
        borderPositions[i3] = borderInitialPositions[i3];
        borderPositions[i3 + 1] = borderInitialPositions[i3 + 1];
        borderPositions[i3 + 2] = borderInitialPositions[i3 + 2];
        const distanceFromBase = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
        const normalizedDistance = Math.min(distanceFromBase / config.borderWidth, 1);
        borderSizes[i] = config.borderParticleMaxSize * (1 - normalizedDistance) + config.borderParticleMinSize * normalizedDistance;
    }
    borderGeometry.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    borderGeometry.setAttribute('size', new THREE.BufferAttribute(borderSizes, 1));
    borderGeometry.setAttribute('initialPosition', new THREE.BufferAttribute(borderInitialPositions, 3));
    borderGeometry.setAttribute('finalPosition', new THREE.BufferAttribute(borderFinalPositions, 3));
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
            float safeValue(float value) {
                return isnan(value) ? 0.0 : value;
            }
            void main() {
                vec3 basePosition = vec3(
                    safeValue(position.x),
                    safeValue(position.y),
                    safeValue(position.z)
                );
                float safePhase = safeValue(phase);
                float safeTime = safeValue(time);
                float offsetX = sin(safeTime * 0.5 + safePhase) * 0.015;
                float offsetY = cos(safeTime * 0.4 + safePhase) * 0.015;
                float offsetZ = sin(safeTime * 0.6 + safePhase) * 0.015;
                vec3 finalPosition = basePosition + vec3(
                    clamp(offsetX, -0.015, 0.015),
                    clamp(offsetY, -0.015, 0.015),
                    clamp(offsetZ, -0.015, 0.015)
                );
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
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                float r = dot(cxy, cxy);
                float delta = fwidth(r);
                float alpha = 1.0 - smoothstep(1.0 - delta, 1.0, r);
                if (alpha <= 0.0) {
                    discard;
                }
                vec3 whiteColor = vec3(1.0);
                vec3 greenColor = vec3(0.0, 254.0/255.0, 165.0/255.0);
                vec3 color = vY > clipPlanePosition * 2.0 ? greenColor : whiteColor;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false
    });
    borderParticles = new THREE.Points(borderGeometry, borderMaterial);
    borderParticles.frustumCulled = true;
    scene.add(borderParticles);
}
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 63, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
}
function onWindowResize() {
    if (!container) return;
    const aspect = container.clientWidth / container.clientHeight;
    const baseWidth = 1920;
    const isMobile = window.innerWidth <= 768;
    const frustumSize = isMobile ? 
        (baseWidth / container.clientWidth) * 1.6 :
        (baseWidth / container.clientWidth) * 3.5;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    const scaleFactor = container.clientWidth / baseWidth * (isMobile ? 1.5 : 1.0);
    if (particles && particles.material.uniforms) {
        particles.material.uniforms.scaleFactor.value = scaleFactor;
        particles.material.uniforms.pointSize.value = config.particleSize * (isMobile ? 1.2 : 1.0);
    }
    if (borderParticles && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.scaleFactor.value = scaleFactor;
        borderParticles.material.uniforms.pointSize.value = config.borderParticleSize * (isMobile ? 1.2 : 1.0);
    }
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 2) : 1;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
}
function cacheElements() {
    thresholdContainer = document.querySelector('.threshold-line-container');
    thresholdLine = document.querySelector('.threshold-line');
}
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
function updateClipPlane() {
    if (!particles || !particles.material || !particles.material.uniforms) return;
    particles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
    particles.material.uniforms.clipPlanePosition.value = config.clipPlanePosition;
    if (borderParticles && borderParticles.material && borderParticles.material.uniforms) {
        borderParticles.material.uniforms.clipPlaneHeight.value = config.clipPlaneHeight;
        borderParticles.material.uniforms.clipPlanePosition.value = config.clipPlanePosition;
    }
}
function updateScroll() {
    const investorSection = document.querySelector('.investor');
    const investorRect = investorSection.getBoundingClientRect();
    const currentScrolled = window.scrollY;
    const windowHeight = window.innerHeight;
    const startPoint = windowHeight * 0.6;
    const sectionTop = investorRect.top;
    if (sectionTop > startPoint || investorRect.bottom <= 0) {
        lastScrollY = currentScrolled;
        return;
    }
    const totalHeight = investorRect.height - windowHeight;
    const currentScroll = -investorRect.top;
    const scrollAtStart = -startPoint;
    const adjustedScroll = currentScroll - scrollAtStart;
    const adjustedTotal = totalHeight - scrollAtStart;
    const scrollProgress = Math.min(100, Math.max(0, (adjustedScroll / adjustedTotal) * 100));
    if (particles) {
        const rotationY = -(scrollProgress / 100) * (180 * Math.PI / 180);
        particles.rotation.y = rotationY;
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
}
function updateParticles() {
    const currentMainSize = particles ? particles.material.uniforms.pointSize.value : config.particleSize;
    const currentBorderSize = borderParticles ? borderParticles.material.uniforms.pointSize.value : config.borderParticleSize;
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
    const originalMainSize = config.particleSize;
    const originalBorderSize = config.borderParticleSize;
    config.particleSize = currentMainSize;
    config.borderParticleSize = currentBorderSize;
    config.borderParticleMaxSize = currentBorderSize;
    config.borderParticleMinSize = currentBorderSize;
    createParticles();
    config.particleSize = originalMainSize;
    config.borderParticleSize = originalBorderSize;
}
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
window.addEventListener('resize', handleResize);
window.addEventListener('beforeunload', dispose);
document.addEventListener('DOMContentLoaded', () => {
    init();
});
