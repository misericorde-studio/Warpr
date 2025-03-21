# Visualisation d'un Cercle de Points en Perspective avec Three.js

Ce projet crée une visualisation 3D d'un cercle de points avec une ondulation sinusoïdale, vu en perspective pour créer un effet d'ellipse inclinée.

## Caractéristiques

- Génère un nuage de points (1000 points) formant un cercle dans le plan horizontal
- Applique une ondulation sinusoïdale sur l'axe Y pour créer un relief ondulé
- Utilise des shaders personnalisés pour ajuster la taille des points en fonction de leur distance à la caméra
- Les points sont de couleur vert clair (#00ffcc)
- Inclut des contrôles d'orbite pour naviguer autour de la visualisation
- Rotation automatique pour un effet dynamique
- **Interface utilisateur interactive** pour ajuster les paramètres en temps réel
- Contrôle de **l'espacement entre les points** pour des effets visuels variés

## Comment exécuter

1. Ouvrez simplement le fichier `index.html` dans un navigateur moderne
2. Aucune installation requise, les dépendances sont chargées via CDN

## Interaction

- **Rotation** : Clic gauche + déplacement
- **Zoom** : Molette de souris ou pincement (tactile)
- **Panoramique** : Clic droit + déplacement ou trois doigts (tactile)

## Contrôles interactifs

L'interface utilisateur permet d'ajuster en temps réel :
- **Espacement des points** : Modifie la distance entre les points sur le cercle
- **Taille des points** : Ajuste la taille de base des points
- **Hauteur d'ondulation** : Contrôle l'amplitude de l'effet sinusoïdal sur l'axe Y
- **Fréquence d'ondulation** : Détermine le nombre d'ondulations autour du cercle

Le panneau de contrôle peut être masqué/affiché avec le bouton "Masquer"/"Afficher".

## Personnalisation

Vous pouvez modifier les paramètres de la visualisation en ajustant les valeurs dans l'objet `config` au début du fichier `main.js` :

```javascript
const config = {
    numPoints: 1000,        // Nombre de points dans le cercle
    radius: 5,              // Rayon du cercle
    pointColor: 0x00ffcc,   // Couleur vert clair
    pointSize: 0.08,        // Taille de base des points
    waveHeight: 0.5,        // Hauteur de l'ondulation
    waveFrequency: 2,       // Fréquence de l'ondulation
    perspectiveEffect: 0.4, // Effet de perspective (0-1)
    rotationSpeed: 0.001,   // Vitesse de rotation
    pointSpacing: 1.0,       // Espacement entre les points
};
```

## Technologies utilisées

- Three.js (v0.160.0)
- WebGL Shaders pour l'effet de perspective
- HTML5 / JavaScript

## Structure du projet

- `index.html` : Point d'entrée HTML avec les contrôles d'interface utilisateur
- `main.js` : Code JavaScript principal avec la logique Three.js 