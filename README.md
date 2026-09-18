# ellipserweb
Image drawing tools
# ELlipserWeb

ELlipserWeb is a browser-based image measurement and annotation tool developed for forensic investigators, crime scene personnel, researchers, students and others who need to perform measurements directly from photographs.

The application runs locally in the user’s browser. Images and project data are not uploaded to a server by the application.

## Development Status

ELlipserWeb is currently a prototype under active development. Features, controls, calculations and project-file compatibility may change as the application is tested and improved.

The current version should not be considered validated for operational forensic use.

## Current Features

* Load and work with multiple images
* Calibrate an image using a known distance
* Measure scaled distances
* Measure angles on scaled images
* Create and adjust circles
* Create and adjust ellipses
* Calculate ellipse dimensions and angles
* Create open polylines
* Create closed polygons
* Calculate scaled perimeter and area
* Organize images and measurements in a structure panel
* Show, hide and lock individual objects
* Display properties for selected objects
* Save projects as `.elp` files
* Reopen saved `.elp` projects
* Export images with measurement overlays

## Basic Controls

* **Left mouse button:** Create or select objects
* **Mouse wheel:** Zoom
* **Right mouse button:** Pan the image
* **Right-click while drawing:** Complete the current polyline or polygon
* **Delete key:** Remove the selected object

## Running ELlipserWeb

ELlipserWeb currently uses standard HTML, CSS and JavaScript and does not require a build process.

To run it locally:

1. Download or clone the repository.
2. Open the project folder in a code editor such as Cursor.
3. Open `index.html` in a modern web browser.

A local web server, such as the Live Server extension for Cursor or Visual Studio Code, can also be used during development.

## Project Files

* `index.html` — Main application interface
* `styles.css` — Interface styling and layout
* `app.js` — Application logic, image handling and measurement tools
* `README.md` — Project information and instructions

## Privacy and Data Handling

ELlipserWeb is designed to process images and measurements locally in the browser.

The application does not currently transmit case images, measurements or project information to a remote server. Images and project information leave the user’s device only when the user intentionally exports, saves or shares them.

Users remain responsible for following their organization’s requirements concerning:

* Evidence handling
* Case confidentiality
* Personal information
* Data security
* File retention
* Validation and documentation

Users should verify this behaviour whenever the application is updated or deployed in a new environment.

## Intended Use and Limitations

ELlipserWeb is intended as a general image measurement, documentation, research and training tool.

Measurements derived from photographs may be affected by:

* Image resolution and compression
* Camera perspective
* Lens distortion
* Calibration accuracy
* Scale placement
* Surface orientation
* Object geometry
* Image editing or resizing
* User technique

The application does not automatically correct for perspective distortion, lens distortion or out-of-plane geometry unless a specific correction method is implemented and documented.

Results should be independently checked before being relied upon for investigative, scientific, operational or legal purposes.

## Browser Compatibility

A current desktop version of one of the following browsers is recommended:

* Google Chrome
* Microsoft Edge
* Mozilla Firefox
* Apple Safari

Some controls are designed primarily for use with a mouse and keyboard. Mobile and touchscreen behaviour may differ.

## Testing and Validation

Before ELlipserWeb is used operationally, its measurement functions should be tested against known ground-truth data.

Testing should consider:

* Different image sizes and aspect ratios
* Multiple browsers and operating systems
* Known distances and angles
* Ellipse and circle fitting
* Polygon area and perimeter
* Saved and reopened projects
* Exported overlay accuracy
* Repeated measurements by different users

Known limitations, uncertainty and test results should be documented.

## Feedback

Bug reports, measurement test results and suggested improvements are welcome.

When reporting a problem, please include:

* Browser and operating system
* Steps required to reproduce the problem
* Expected result
* Actual result
* Screenshots, if appropriate
* Whether the project was newly created or opened from an `.elp` file

Do not include confidential case information or evidentiary images in public bug reports.

## Copyright and Use

Copyright © 2026 Eugene Liscio / ai2-3D. All rights reserved.

No licence is currently granted for the reproduction, modification, distribution or commercial use of this source code.

The public availability of this repository does not place the source code in the public domain or grant permission for reuse. Permission may be granted separately in writing by the copyright holder.
