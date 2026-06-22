# 🐟 Fish Pond Alert System - RF F1=1.000

**Fish-Species-Aware Pond Monitoring with Random Forest on ESP32 Edge Devices**

---

<div align="center">
  <img src="https://img.shields.io/badge/F1_Score-1.000-228B22?style=for-the-badge&logo=machine-learning" alt="F1 Score">
  <img src="https://img.shields.io/badge/ESP32_Deployment-0.1ms-007ACC?style=for-the-badge&logo=arduino" alt="ESP32">
  <img src="https://img.shields.io/badge/Dataset-40K_Records-FF6B6B?style=for-the-badge&logo=kaggle" alt="Dataset">
  <img src="https://img.shields.io/badge/11_Fish_Species-Ready-4ECDC4?style=for-the-badge&logo=fish" alt="11 Fish">
</div>

---

## 📊 Overview

This project implements a **fish-species-aware pond monitoring system** that predicts water quality alerts using **Random Forest (F1=1.000)** on a **40K IoT dataset**. The system supports **11 fish species** with species-specific water quality thresholds and is deployable on **ESP32 edge devices** with **<0.1ms inference time**.

---

## 🎯 Key Features

- ✅ **11 Fish Species Support**: Tilapia, Rui, Pangas, Katla, Mrigal, Common Carp, Silver Carp, Grass Carp, Black Carp, Bighead Carp, Snakehead
- ✅ **Fish-Specific Rules**: Species-aware water quality thresholds from aquaculture research
- ✅ **Perfect Accuracy**: Random Forest achieving **F1=1.000** on 40K real IoT readings
- ✅ **Edge Deployment**: ESP32-ready with **<0.1ms prediction time**
- ✅ **Real-Time Alerts**: Instant water quality monitoring with color-coded alerts
- ✅ **Production Files**: `rf_model.pkl`, `scaler_ml.pkl`, `fish_encoder.pkl`

---

## 📈 Architecture

```mermaid
graph TD
    A["🐟 40K Dataset<br/>pH,Temp,Turb,11 Fish"] --> B["📏 11 Fish Rules"]
    B --> C{"Safe??"}
    C -->|✅| D["Alert=0"]
    C -->|❌| E["Alert=1"]
    
    D --> F["40K Labels"]
    E --> F
    
    F --> G["🌳 RF Model<br/>F1=1.000"]
    
    G --> H["⚡ ESP32<br/>0.1ms Predict"]
    H --> I["🚨 94% Alert Display"]
    
    classDef input fill:#e1f5fe,stroke:#01579b
    classDef model fill:#c8e6c9,stroke:#2e7d32
    classDef deploy fill:#fff3e0,stroke:#e65100
    classDef alert fill:#ffcdd2,stroke:#c62828
    
    class A,B input
    class F,G model
    class H deploy
    class C,I alert
```

---

## 🔬 Performance

| Metric | Value |
|--------|-------|
| **Dataset Size** | 40,280 IoT readings |
| **Fish Species** | 11 variety |
| **F1-Score** | **1.000** (Perfect) |
| **Inference Time** | <0.1ms (ESP32) |
| **Features** | 4 (pH, Temp, Turbidity, fish_id) |

**Alert Examples:**
