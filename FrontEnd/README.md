# Fish Pond Alert System — Frontend Dashboard

Modern real-time fish pond monitoring dashboard powered by a **Random Forest** model (F1 = 1.000).

## Project Structure

```
FrontEnd/
├── index.html       # Main dashboard UI
├── style.css        # Dark theme + glassmorphism + animated gauges
├── script.js        # Client-side prediction & live gauges
├── app.py           # Flask API backend (loads trained .pkl models)
└── README.md        # This file

ML_script/
├── fish_farming.csv
├── fish_monitoring.ipynb
├── rf_model.pkl          # Trained Random Forest model
├── scaler_ml.pkl         # StandardScaler
└── fish_encoder.pkl      # LabelEncoder for fish species
```

## Quick Start

### Option 1 — Standalone (no backend)

Simply open `index.html` in a browser. The dashboard uses **rule-based prediction** that exactly matches the trained RF model's logic (F1 = 1.000).

```
# Just double-click index.html, or:
start index.html
```

### Option 2 — With Flask API (uses actual RF model)

1. **Generate model files** — run the notebook `ML_script/fish_monitoring.ipynb` to produce `rf_model.pkl`, `scaler_ml.pkl`, and `fish_encoder.pkl`.

2. **Install dependencies**:
   ```
   pip install flask flask-cors scikit-learn numpy
   ```

3. **Start the API**:
   ```
   cd FrontEnd
   python app.py
   ```

4. **Open the dashboard** — navigate to `http://127.0.0.1:5000` or open `index.html`. The frontend auto-detects the API and switches from standalone to API mode (indicated by a green dot in the header).

## Features

| Feature | Description |
|---|---|
| **Real-time gauges** | Animated SVG gauges for pH, Temperature, Turbidity |
| **11 fish species** | Dropdown with all species from the dataset |
| **Live sliders** | Drag to adjust values — gauges update instantly |
| **Alert prediction** | RF model or rule-based with probability percentage |
| **Colour-coded results** | Green (safe) / Red (alert) with glow animations |
| **Probability ring** | Circular progress showing alert probability |
| **Buzzer sound** | Web Audio API alert beep on danger detection |
| **Prediction history** | Scrollable table of all past predictions |
| **Responsive design** | Works on desktop, tablet, and mobile (ESP32 dashboard) |
| **Dark theme** | Professional dark UI with glassmorphism cards |

## Fish Species & Safe Ranges

| Species | pH Range | Temp (°C) | Max Turbidity (NTU) |
|---|---|---|---|
| Tilapia | 6.5 – 8.5 | 18 – 32 | 5 |
| Katla | 6.5 – 8.0 | 20 – 32 | 5 |
| Rui | 6.5 – 8.0 | 18 – 30 | 5 |
| Pangas | 6.8 – 8.5 | 20 – 32 | 5 |
| Koi | 6.5 – 8.5 | 18 – 28 | 6 |
| Magur | 6.5 – 8.0 | 22 – 32 | 5 |
| Sing | 6.0 – 8.0 | 24 – 32 | 6 |
| Karpio | 6.5 – 8.5 | 18 – 28 | 6 |
| Silver Cup | 6.5 – 8.0 | 18 – 28 | 5 |
| Prawn | 6.5 – 8.5 | 18 – 30 | 5 |
| Shrimp | 6.5 – 8.5 | 18 – 30 | 5 |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns model status and available species |
| POST | `/predict` | Returns alert prediction for given parameters |

### POST `/predict` example

```json
// Request
{
  "fish": "katla",
  "pH": 6.1,
  "temperature": 28,
  "turbidity": 4.2
}

// Response
{
  "alert": true,
  "probability": 0.94,
  "reasons": ["Low pH"],
  "status": { "phOk": false, "tempOk": true, "turbOk": true },
  "model": "RandomForest"
}
```

## Tech Stack

- **Frontend**: HTML5, CSS3 (custom properties, animations), Vanilla JS (ES6+)
- **Backend**: Flask + Flask-CORS
- **ML**: scikit-learn RandomForestClassifier
- **Audio**: Web Audio API (alert buzzer)
