# Exoplanets: Data Visualisation Project

Interactive website exploring exoplanets, planetary systems, discovery methods and detection bias.
Created for the course **Datavisualisatie** at **Ghent University**.

## Authors

- Maxime Deryck
- Robin Mattheeuws
- Niels Struye

## Live website

[Visit the website](https://datavisualiatie-ugent.github.io/project-dv26-10/)

## Dataset

This project uses data from the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/).
We worked with the composite dataset, where measurements from multiple scientific publications are combined into a single description per exoplanet.

The dataset includes information about:

- planetary properties
- stellar properties
- sky coordinates
- discovery methods
- measurement uncertainties

## Technologies

- HTML
- CSS
- JavaScript
- D3.js
- Python
- KaTeX

## Project structure

The website consists of three main pages.

### Overview

The landing page introduces the dataset, displays the number of confirmed planets and planetary systems, and explains the main exoplanet detection methods.

### Explore dataset

This page allows users to explore the archive interactively through:

- an exoplanet search and filtering lab
- summary statistics and comparisons between the selected exoplanet and archive medians
- a timeline and bar chart of discoveries by method
- a map of observatories and space telescopes
- a sky map of the confirmed exoplanets across the celestial sphere
- a visualisation of exoplanetary systems and orbital distances

### Are we unique?

This story-driven page focuses on detection bias and compares known exoplanet systems with our own Solar System. It includes:

- a comparison between the average exoplanet system and our Solar System
- orbital period density plots across discovery methods
- a mass versus orbital distance scatter plot
- measurement precision boxplots across discovery methods
- a habitable zone visualisation

## Running locally

Clone the repository and open the project with a local web server. For example, using the VSCode Live Server extension:

1. Open the repository in VSCode
2. Right-click `index.html`
3. Select **Open with Live Server**

## External resources

- NASA Exoplanet Archive dataset
- World GeoJSON map from D3 Graph Gallery
- Icons from Icons8
- Fonts from Google Fonts