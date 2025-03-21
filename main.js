import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const config = {
    // Paramètres des cercles
    innerRadius: 0.5,           // Rayon du cercle intérieur
    outerRadius: 6,           // Rayon du cercle extérieur
    
    // Paramètres des particules
    innerCircleParticles: 100, // Nombre de particules dans le cercle intérieur
    outerCircleParticles: 1700, // Nombre de particules dans le cercle extérieur
    baseParticleSize: 0.6,    // Taille de base des particules
    particleColor: 0x00ffcc,  // Couleur des particules
    
    // Paramètres d'animation
    maxParticleDistance: 3,   // Distance maximale que peuvent parcourir les particules depuis leur cercle
    particleSpeed: 0.02,      // Vitesse de déplacement des particules
    fadeWithDistance: 0.8,    // Réduction de taille avec la distance (0-1)
    
    // Paramètres visuels
    perspectiveEffect: 0.4,   // Effet de perspective (0-1)
    staticRingWidth: 1,     // Largeur de l'anneau statique du cercle extérieur (0-1) de l'épaisseur totale
    outerOutwardRatio: 0.6,   // Proportion de particules se déplaçant vers l'extérieur (cercle extérieur)
    innerCircleFill: 0.9,     // Proportion du rayon intérieur à remplir (0 = juste le contour, 1 = tout le cercle)
    
    // NOUVEAU: Paramètres de gestion du flux de particules
    minMobileRatio: 0.3,      // Ratio minimum de particules mobiles par rapport aux particules du cercle extérieur
    
    // NOUVEAU: Paramètres pour les cercles supplémentaires
    additionalCircles: 4,      // Nombre de cercles supplémentaires
    additionalCircleParticles: 100, // Nombre de particules par cercle supplémentaire (même que innerCircleParticles)
    additionalCircleVerticalSpacing: 0.5, // Espacement vertical entre les cercles
};

// Configuration de la caméra avec un champ de vision adapté
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Configuration de l'animation au scroll
const scrollConfig = {
    startRotationX: 90,  // Rotation X initiale en degrés (vue de dessus)
    endRotationX: 11,   // Rotation X finale en degrés
    startDistance: 13,   // Distance initiale
    endDistance: 4.45,   // Distance finale
};

console.log("Configuration de l'animation au scroll:", scrollConfig);

// Fonction pour mettre à jour la position de la caméra en fonction du scroll
function updateCameraFromScroll() {
    // Obtenir les sections
    const sections = document.querySelectorAll('.airdrop_content');
    if (sections.length < 2) return;
    
    const secondSection = sections[1];
    const secondSectionRect = secondSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Calculer la progression du scroll:
    // - 0 quand la deuxième section est en bas du viewport
    // - 1 quand la deuxième section est en haut du viewport
    let scrollProgress = 1 - (secondSectionRect.top / viewportHeight);
    
    // Limiter entre 0 et 1
    scrollProgress = Math.max(0, Math.min(1, scrollProgress));
    
    // Log de la progression (tous les 60 frames)
    if (frameCount % 60 === 0) {
        console.log(`Second section: top=${secondSectionRect.top}, viewport height=${viewportHeight}`);
        console.log(`Scroll progress: ${scrollProgress.toFixed(2)}`);
    }
    
    // Calcul de l'angle de rotation actuel (interpolation linéaire)
    const currentRotationX = scrollConfig.startRotationX + 
                           (scrollConfig.endRotationX - scrollConfig.startRotationX) * scrollProgress;
    
    // Calcul de la distance actuelle (interpolation linéaire)
    const currentDistance = scrollConfig.startDistance + 
                          (scrollConfig.endDistance - scrollConfig.startDistance) * scrollProgress;
    
    // Convertir les degrés en radians
    const angleInRadians = THREE.MathUtils.degToRad(currentRotationX);
    
    // Calculer la position du troisième cercle (index 2)
    const targetY = -2 * config.additionalCircleVerticalSpacing;
    
    // Positionner la caméra en fonction de la rotation X
    // La position est relative au troisième cercle qui est notre nouveau centre
    if (currentRotationX === 90) {
        // Position exacte à 90 degrés (vue de dessus)
        camera.position.set(0, currentDistance + targetY, 0);
    } else {
        const y = currentDistance * Math.sin(angleInRadians) + targetY;
        const z = -currentDistance * Math.cos(angleInRadians);
        camera.position.set(0, y, z);
    }
    
    // Regarder vers le centre du troisième cercle
    camera.lookAt(0, targetY, 0);
    
    // Mise à jour de l'information de caméra dans l'interface
    updateCameraInfo();
    
    // Log pour débogage (tous les 60 frames)
    if (frameCount % 60 === 0) {
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
        console.log(`Rotation - X: ${THREE.MathUtils.radToDeg(euler.x).toFixed(2)}°, Y: ${THREE.MathUtils.radToDeg(euler.y).toFixed(2)}°, Z: ${THREE.MathUtils.radToDeg(euler.z).toFixed(2)}°`);
        console.log(`Angle cible X: ${currentRotationX.toFixed(2)}°`);
        console.log(`Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
    }
}

// Initialisation de la scène, caméra et renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0B0E13);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true // Permettre la transparence
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0); // Fond transparent

// Contrôles d'orbite pour naviguer (désactivés par défaut)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false; // Désactiver les contrôles par défaut

// Classe pour gérer chaque particule
class Particle {
    constructor(index) {
        this.index = index;
        
        // Valeurs par défaut qui seront remplacées lors de la création
        this.isInnerCircle = false;
        this.isAdditionalCircle = false;
        this.additionalCircleIndex = -1;
        this.isStatic = false;
        
        this.active = true; // Toutes les particules sont actives par défaut
        // Les autres propriétés seront initialisées par resetParticle()
    }
    
    resetParticle() {
        if (this.isInnerCircle || this.isAdditionalCircle) {
            // Comportement commun pour le cercle principal et les cercles supplémentaires
            
            // Position aléatoire dans le cercle 
            const angle = Math.random() * Math.PI * 2;
            // Distribution dans tout le cercle (pas seulement sur le contour)
            const radiusFactor = Math.pow(Math.random(), 0.5) * config.innerCircleFill; // Racine carrée pour distribution uniforme
            this.radius = config.innerRadius * radiusFactor;
            
            this.isStatic = true;
            this.angle = angle;
            
            // Position horizontale (commune à tous les cercles)
            this.x = Math.cos(this.angle) * this.radius;
            this.z = Math.sin(this.angle) * this.radius;
            
            // Position verticale (spécifique à chaque cercle)
            if (this.isInnerCircle) {
                this.y = 0; // Le cercle principal est à y=0
            } else if (this.isAdditionalCircle) {
                // Position avec décalage vertical selon l'index du cercle supplémentaire
                this.y = -(this.additionalCircleIndex + 1) * config.additionalCircleVerticalSpacing;
            }
            
            // Pas de direction pour les particules statiques
            this.direction = 0;
            this.distanceTraveled = 0;
            
            // Taille de base variée, avec réduction progressive pour les cercles supplémentaires
            let sizeFactor = 1.0;
            if (this.isAdditionalCircle) {
                // Légère réduction progressive avec la profondeur
                sizeFactor = 0.9 - (this.additionalCircleIndex * 0.05); 
            }
            
            this.size = config.baseParticleSize * (0.7 + Math.random() * 0.6) * sizeFactor;
            this.currentSize = this.size;
            
            // Ajouter une légère pulsation (fréquence différente pour chaque cercle)
            this.pulseSpeed = 0.01 + Math.random() * 0.02;
            if (this.isAdditionalCircle) {
                this.pulseSpeed += this.additionalCircleIndex * 0.002; // Variation subtile entre les cercles
            }
            this.pulsePhase = Math.random() * Math.PI * 2;
        } else {
            // Réinitialiser en tant que particule du cercle extérieur
            this.resetOuterParticle();
        }
    }
    
    // Méthode pour réinitialiser spécifiquement une particule du cercle extérieur
    resetOuterParticle() {
        this.radius = config.outerRadius;
        
        // Angle aléatoire autour du cercle
        this.angle = Math.random() * Math.PI * 2;
        
        // Position initiale exactement sur le cercle ou légèrement variée
        const radiusVariation = (Math.random() * 0.2) - 0.1;
        this.radius += radiusVariation;
        
        this.x = Math.cos(this.angle) * this.radius;
        this.y = (Math.random() - 0.5) * 0.3; // Légère variation sur Y
        this.z = Math.sin(this.angle) * this.radius;
        
        // MODIFICATION: Forcer un pourcentage fixe de particules mobiles
        // Pour garantir un flux constant, nous réduisons la probabilité de particules statiques
        if (Math.random() < config.staticRingWidth * 0.8) {
            // Particule statique
            this.isStatic = true;
            this.direction = 0;
            
            // Taille de base pour les particules statiques
            this.size = config.baseParticleSize * (0.7 + Math.random() * 0.6);
            this.currentSize = this.size;
            
            // Pulsation pour les particules statiques
            this.pulseSpeed = 0.01 + Math.random() * 0.02;
            this.pulsePhase = Math.random() * Math.PI * 2;
        } else {
            // Particule mobile
            this.isStatic = false;
            
            // Direction du mouvement
            this.direction = -1; // Par défaut vers l'intérieur
            
            // MODIFICATION: Augmenter légèrement la probabilité que les particules aillent vers l'intérieur
            // pour maintenir un flux constant vers le cercle intérieur
            if (Math.random() < config.outerOutwardRatio * 0.9) {
                this.direction = 1;
            }
            
            // Taille de base pour les particules mobiles
            this.size = config.baseParticleSize * (0.7 + Math.random() * 0.6);
            this.currentSize = this.size;
            
            // MODIFICATION: Vitesse légèrement plus variée pour éviter que toutes les particules
            // n'atteignent le cercle intérieur en même temps
            this.speed = config.particleSpeed * (0.7 + Math.random() * 0.6);
        }
        
        // Distance parcourue depuis le cercle
        this.distanceTraveled = 0;
        
        // Marquer la particule comme active
        this.active = true;
    }
    
    update(deltaTime) {
        if (!this.active) return;

        if (this.isStatic) {
            // Pour les particules statiques (cercle intérieur et cercles supplémentaires), une légère pulsation
            const pulse = Math.sin(this.pulsePhase) * 0.15 + 1;
            this.currentSize = this.size * pulse;
            this.pulsePhase += this.pulseSpeed;
            return;
        }
        
        // Déplacement des particules du cercle extérieur
        
        // Mettre à jour la distance parcourue
        this.distanceTraveled += this.speed * this.direction;
        
        // Si la particule a atteint sa distance maximale vers l'extérieur, la réinitialiser
        if (this.direction > 0 && this.distanceTraveled > config.maxParticleDistance) {
            this.resetOuterParticle();
            return;
        }
        
        // Calculer la nouvelle position radiale
        const currentRadius = this.radius + this.distanceTraveled;
        
        // Si la particule va vers l'intérieur et atteint le cercle intérieur, la réinitialiser
        if (this.direction < 0 && currentRadius <= config.innerRadius) {
            // MODIFICATION: Ne pas réinitialiser en fonction de isInnerCircle, 
            // toujours réinitialiser au cercle extérieur pour garantir le flux
            this.resetOuterParticle();
            return;
        }
        
        // Mettre à jour la position
        this.x = Math.cos(this.angle) * currentRadius;
        this.z = Math.sin(this.angle) * currentRadius;
        
        // Petite oscillation verticale pendant le mouvement
        this.y += (Math.random() - 0.5) * 0.01;
        this.y *= 0.98; // Amortissement pour éviter une trop grande dispersion
        
        // Facteur de taille basé sur la distance parcourue
        const distanceFactor = 1.0 - (Math.abs(this.distanceTraveled) / config.maxParticleDistance) * config.fadeWithDistance;
        this.currentSize = this.size * distanceFactor;
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
    
    // Initialiser avec des valeurs par défaut
    for (let i = 0; i < totalParticles; i++) {
        const idx = i * 3;
        // Position par défaut
        positions[idx] = 0;
        positions[idx + 1] = 0;
        positions[idx + 2] = 0;
        // Taille par défaut
        sizes[i] = config.baseParticleSize;
        // Couleur par défaut
        const color = new THREE.Color(config.particleColor);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
    }
    
    const baseColor = {
        r: new THREE.Color(config.particleColor).r, 
        g: new THREE.Color(config.particleColor).g, 
        b: new THREE.Color(config.particleColor).b
    };
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return { geometry, positions, sizes, colors, baseColor };
}

// Créer le matériau pour les particules
function createParticlesMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            cameraPos: { value: camera.position }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform vec3 cameraPos;
            
            void main() {
                vColor = color;
                
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
            
            void main() {
                // Calcul de la distance au centre du point
                vec2 center = vec2(0.5, 0.5);
                float dist = length(gl_PointCoord - center);
                
                // Création d'un point circulaire avec un dégradé doux
                float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
                
                // Couleur finale avec transparence
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: false
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
        particle.isStatic = true;
        particle.resetParticle();
        particles.push(particle);
    }
    
    // Créer les particules pour les cercles supplémentaires
    for (let circleIndex = 0; circleIndex < config.additionalCircles; circleIndex++) {
        for (let i = 0; i < config.additionalCircleParticles; i++) {
            const particle = new Particle(index++);
            particle.isInnerCircle = false;
            particle.isAdditionalCircle = true;
            particle.additionalCircleIndex = circleIndex;
            particle.isStatic = true;
            particle.resetParticle();
            particles.push(particle);
        }
    }
    
    // Créer les particules pour le cercle extérieur
    let staticCount = 0;
    let mobileCount = 0;
    const targetMobileRatio = 0.4; // Augmenter le ratio cible de particules mobiles
    
    for (let i = 0; i < config.outerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = false;
        particle.isAdditionalCircle = false;
        
        // S'assurer que nous avons suffisamment de particules mobiles
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
    
    console.log(`Particules créées: ${particles.length} total, avec ${mobileCount} mobiles (${((mobileCount / config.outerCircleParticles) * 100).toFixed(1)}%)`);
    return particles;
}

// Créer la géométrie et le matériau pour les particules
let particles = createParticles();
let { geometry, positions, sizes, colors, baseColor } = createParticlesGeometry();
let particlesMaterial = createParticlesMaterial();
let particlesObject = new THREE.Points(geometry, particlesMaterial);
scene.add(particlesObject);

// Ajouter des cercles guides (pour visualiser les orbites)
function createGuideCircles() {
    const guideGroup = new THREE.Group();
    
    // Cercle intérieur principal
    const innerCircleGeometry = new THREE.RingGeometry(config.innerRadius - 0.02, config.innerRadius + 0.02, 64);
    const innerCircleMaterial = new THREE.MeshBasicMaterial({ 
        color: config.particleColor, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
    });
    const innerCircle = new THREE.Mesh(innerCircleGeometry, innerCircleMaterial);
    innerCircle.rotation.x = Math.PI / 2; // Orienter horizontalement
    guideGroup.add(innerCircle);
    
    // Cercles supplémentaires
    for (let i = 0; i < config.additionalCircles; i++) {
        const additionalCircleGeometry = new THREE.RingGeometry(
            config.innerRadius - 0.02, 
            config.innerRadius + 0.02, 
            64
        );
        const additionalCircleMaterial = new THREE.MeshBasicMaterial({ 
            color: config.particleColor, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        const additionalCircle = new THREE.Mesh(additionalCircleGeometry, additionalCircleMaterial);
        additionalCircle.rotation.x = Math.PI / 2; // Orienter horizontalement
        
        // Positionner verticalement
        additionalCircle.position.y = -(i + 1) * config.additionalCircleVerticalSpacing;
        
        guideGroup.add(additionalCircle);
    }
    
    // Cercle extérieur
    const outerCircleGeometry = new THREE.RingGeometry(config.outerRadius - 0.02, config.outerRadius + 0.02, 64);
    const outerCircleMaterial = new THREE.MeshBasicMaterial({ 
        color: config.particleColor, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
    });
    const outerCircle = new THREE.Mesh(outerCircleGeometry, outerCircleMaterial);
    outerCircle.rotation.x = Math.PI / 2; // Orienter horizontalement
    guideGroup.add(outerCircle);
    
    return guideGroup;
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

// Animation
let frameCount = 0; // Compteur de frames pour diagnostic

// Variable pour suivre si l'utilisateur a commencé à défiler
let hasScrolled = false;

function animate() {
    requestAnimationFrame(animate);
    
    // Mettre à jour la position de la caméra en fonction du scroll uniquement si l'utilisateur a défilé
    if (hasScrolled) {
        updateCameraFromScroll();
    }
    
    // Compteur de particules pour diagnostic
    let inactiveCount = 0;
    let innerCount = 0;
    let additionalCount = 0;
    let outerCount = 0;
    let movingCount = 0;
    
    // Mise à jour des particules
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(0.016); // Environ 60 FPS
        
        // Compter les types de particules pour diagnostic
        if (!particles[i].active) inactiveCount++;
        if (particles[i].isInnerCircle) innerCount++;
        if (particles[i].isAdditionalCircle) additionalCount++;
        if (!particles[i].isInnerCircle && !particles[i].isAdditionalCircle) outerCount++;
        if (!particles[i].isStatic) movingCount++;
        
        // Mettre à jour la position
        const idx = i * 3;
        positions[idx] = particles[i].x;
        positions[idx + 1] = particles[i].y;
        positions[idx + 2] = particles[i].z;
        
        // Mettre à jour la taille
        sizes[i] = particles[i].currentSize;
        
        // Mettre à jour la couleur
        colors[idx] = baseColor.r;
        colors[idx + 1] = baseColor.g;
        colors[idx + 2] = baseColor.b;
    }
    
    // AJOUT: Vérifier si le nombre de particules mobiles est trop bas
    // et forcer la réinitialisation de certaines particules statiques en particules mobiles
    const minMobileParticles = Math.floor(config.outerCircleParticles * config.minMobileRatio);
    
    // Ne vérifier que si on est sous le seuil et pas trop fréquemment (tous les 10 frames)
    if (movingCount < minMobileParticles && frameCount % 10 === 0) {
        // Calculer le nombre exact de particules à convertir
        const particlesToConvert = Math.min(50, minMobileParticles - movingCount);
        
        console.log(`Nombre de particules mobiles trop bas (${movingCount}/${minMobileParticles}), conversion de ${particlesToConvert} particules...`);
        
        // Réinitialiser certaines particules du cercle extérieur pour les rendre mobiles
        let resetCount = 0;
        
        // Calcul de l'index de début des particules du cercle extérieur
        const outerCircleStartIndex = config.innerCircleParticles + (config.additionalCircles * config.additionalCircleParticles);
        
        for (let i = outerCircleStartIndex; i < particles.length && resetCount < particlesToConvert; i++) {
            if (particles[i].isStatic) {
                // Forcer cette particule statique du cercle extérieur à devenir mobile
                particles[i].isStatic = false;
                
                // Favoriser les particules allant vers l'intérieur pour maintenir le flux
                particles[i].direction = Math.random() < 0.7 ? -1 : 1;
                
                // Varier les vitesses pour un mouvement plus naturel
                particles[i].speed = config.particleSpeed * (0.7 + Math.random() * 0.6);
                
                // Réinitialiser la distance parcourue
                particles[i].distanceTraveled = 0;
                
                resetCount++;
            }
        }
        
        if (resetCount > 0) {
            console.log(`${resetCount} particules ont été converties en particules mobiles.`);
        }
    }
    
    // Log de diagnostic (à commenter en production)
    if (frameCount % 60 === 0) {  // Log tous les 60 frames
        console.log(`Particules - Total: ${particles.length}, Inactives: ${inactiveCount}, Cercle intérieur: ${innerCount}, Cercles additionnels: ${additionalCount}, Cercle extérieur: ${outerCount}, Mobiles: ${movingCount}`);
    }
    
    // Mise à jour de la géométrie des particules
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    
    // Mise à jour des indicateurs de caméra
    updateCameraInfo();
    
    renderer.render(scene, camera);
    
    // Incrémenter le compteur de frames
    frameCount++;
}

// Modifier la fonction init pour placer le canvas dans le conteneur et initialiser la caméra à 90°
function init() {
    // Ajouter le canvas au conteneur
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        // Vider le conteneur au cas où il y aurait déjà un canvas
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(renderer.domElement);
        
        // Calculer la position du troisième cercle (index 2)
        const targetY = -2 * config.additionalCircleVerticalSpacing;
        
        // Positionner la caméra avec un angle X de 90 degrés (vue de dessus)
        camera.position.set(0, scrollConfig.startDistance + targetY, 0);
        camera.up.set(0, 0, 1); // Définir l'axe Z comme direction "vers le haut"
        camera.lookAt(0, targetY, 0); // Regarder vers le centre du troisième cercle
        
        // Log de debug pour vérifier la position et rotation
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
        console.log(`Position initiale: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
        console.log(`Rotation initiale - X: ${THREE.MathUtils.radToDeg(euler.x).toFixed(2)}°, Y: ${THREE.MathUtils.radToDeg(euler.y).toFixed(2)}°, Z: ${THREE.MathUtils.radToDeg(euler.z).toFixed(2)}°`);
        console.log(`Distance initiale: ${camera.position.length().toFixed(2)}`);
        
        // Créer et ajouter les cercles guides
        guideCircles = createGuideCircles();
        scene.add(guideCircles);
        
        // Ajouter l'axe pour visualisation au niveau du troisième cercle
        const axesHelper = new THREE.AxesHelper(2);
        axesHelper.position.set(0, targetY, 0); // Positionner les axes sur le troisième cercle
        scene.add(axesHelper);
        
        // Désactiver les contrôles d'orbite pour empêcher toute interférence
        controls.enabled = false;
        
        // Mettre à jour l'affichage de la caméra
        updateCameraInfo();
        
        // Initialiser l'animation
        animate();
    } else {
        console.error("Canvas container not found");
    }
}

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
            
            // Pour le nombre de particules, recréer les particules
            if (['innerCircleParticles', 'outerCircleParticles'].includes(property)) {
                // Si nous modifions le nombre de particules du cercle intérieur, mettre à jour aussi
                // le nombre de particules pour les cercles supplémentaires
                if (property === 'innerCircleParticles') {
                    config.additionalCircleParticles = value;
                }
                // Recréer le tableau de particules et la géométrie
                recreateParticles();
            }
            
            // Appliquer les changements selon le paramètre
            if (['innerRadius', 'outerRadius', 'additionalCircleVerticalSpacing'].includes(property)) {
                // Recréer les cercles guides
                scene.remove(guideCircles);
                guideCircles = createGuideCircles();
                scene.add(guideCircles);
                
                // Réinitialiser les particules pour s'adapter aux nouveaux rayons/positions
                for (let i = 0; i < particles.length; i++) {
                    particles[i].resetParticle();
                }
            }
            
            // Pour certains paramètres, réinitialiser complètement les particules
            if (['staticRingWidth', 'outerOutwardRatio', 'innerCircleFill'].includes(property)) {
                for (let i = 0; i < particles.length; i++) {
                    particles[i].resetParticle();
                }
            }
            
            // Pour la perspective, recréer le matériau
            if (property === 'perspectiveEffect') {
                // Recréer le matériau avec la nouvelle valeur d'effet de perspective
                scene.remove(particlesObject);
                particlesMaterial = createParticlesMaterial();
                particlesObject = new THREE.Points(geometry, particlesMaterial);
                scene.add(particlesObject);
            }
            
            // Pour la taille des particules
            if (property === 'baseParticleSize') {
                for (let i = 0; i < particles.length; i++) {
                    particles[i].size = value * (0.7 + Math.random() * 0.6);
                }
            }
        });
    };

    // Fonction pour recréer complètement le système de particules
    function recreateParticles() {
        console.log("Recréation des particules...");
        
        // Recréer toutes les particules en utilisant notre fonction
        particles = createParticles();
        
        // Recréer la géométrie pour les nouvelles particules
        scene.remove(particlesObject);
        ({ geometry, positions, sizes, colors, baseColor } = createParticlesGeometry());
        particlesMaterial = createParticlesMaterial();
        particlesObject = new THREE.Points(geometry, particlesMaterial);
        scene.add(particlesObject);
        
        // Compter et afficher les statistiques
        let mobileCount = 0;
        let staticCount = 0;
        let innerCount = 0;
        let additionalCount = 0;
        
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].isInnerCircle) innerCount++;
            else if (particles[i].isAdditionalCircle) additionalCount++;
            else if (particles[i].isStatic) staticCount++;
            else mobileCount++;
        }
        
        console.log(`Statistiques après recréation:
        - Particules cercle intérieur: ${innerCount}
        - Particules cercles additionnels: ${additionalCount}
        - Particules extérieures statiques: ${staticCount}
        - Particules extérieures mobiles: ${mobileCount}
        - Total: ${particles.length}`);
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
    } else {
        console.error("Bouton de masquage/affichage non trouvé");
    }
    
    // Configuration des contrôles spécifiques
    setupControl('innerRadius', 'innerRadius', 0.5, 4, 0.1);
    setupControl('outerRadius', 'outerRadius', 3, 10, 0.1);
    setupControl('innerCircleParticles', 'innerCircleParticles', 100, 1000, 50);
    setupControl('outerCircleParticles', 'outerCircleParticles', 100, 2000, 50);
    setupControl('baseParticleSize', 'baseParticleSize', 0.1, 1, 0.05);
    setupControl('maxParticleDistance', 'maxParticleDistance', 0.5, 5, 0.1);
    setupControl('particleSpeed', 'particleSpeed', 0.005, 0.05, 0.001);
    setupControl('fadeWithDistance', 'fadeWithDistance', 0, 1, 0.05);
    setupControl('innerCircleFill', 'innerCircleFill', 0, 1, 0.05);
    setupControl('staticRingWidth', 'staticRingWidth', 0, 1, 0.05);
    setupControl('outerOutwardRatio', 'outerOutwardRatio', 0, 1, 0.05);
    setupControl('perspectiveEffect', 'perspectiveEffect', 0, 1, 0.05);
    setupControl('minMobileRatio', 'minMobileRatio', 0.1, 0.7, 0.05);
    setupControl('additionalCircleVerticalSpacing', 'additionalCircleVerticalSpacing', 0.2, 1.5, 0.1);
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
    console.log("Écouteur d'événement de défilement ajouté");
    
    // Initialiser les contrôles
    setupControls();
    setupCameraInfoToggle();
    
    // Vérifier le nombre initial de particules mobiles
    let initialMovingCount = 0;
    for (let i = 0; i < particles.length; i++) {
        if (!particles[i].isStatic) initialMovingCount++;
    }
    
    // S'assurer qu'il y a suffisamment de particules mobiles au départ
    const minMobileParticles = Math.floor(config.outerCircleParticles * config.minMobileRatio);
    if (initialMovingCount < minMobileParticles) {
        console.log(`Nombre initial de particules mobiles (${initialMovingCount}) inférieur au minimum requis (${minMobileParticles}), ajustement...`);
        
        // Calcul de l'index de début des particules du cercle extérieur
        const outerCircleStartIndex = config.innerCircleParticles + (config.additionalCircles * config.additionalCircleParticles);
        
        // Convertir certaines particules statiques en particules mobiles
        let adjustedCount = 0;
        for (let i = outerCircleStartIndex; i < particles.length && initialMovingCount < minMobileParticles; i++) {
            if (particles[i].isStatic) {
                particles[i].isStatic = false;
                particles[i].direction = -1; // Vers l'intérieur par défaut
                particles[i].speed = config.particleSpeed * (0.7 + Math.random() * 0.6);
                adjustedCount++;
                initialMovingCount++;
            }
        }
        
        console.log(`${adjustedCount} particules converties en particules mobiles au démarrage.`);
    }
});

// Gestion du bouton pour afficher/masquer les indicateurs de caméra
function setupCameraInfoToggle() {
    const cameraInfoPanel = document.getElementById('camera-info');
    const toggleButton = document.getElementById('toggleCameraInfo');
    let infoVisible = true;
    
    if (toggleButton && cameraInfoPanel) {
        toggleButton.addEventListener('click', () => {
            if (infoVisible) {
                // Masquer les statistiques - sauf le bouton
                const children = cameraInfoPanel.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i] !== toggleButton) {
                        children[i].style.display = 'none';
                    }
                }
                cameraInfoPanel.style.padding = '5px';
                toggleButton.textContent = 'Afficher';
            } else {
                // Réafficher les statistiques
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