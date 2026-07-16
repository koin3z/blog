---
title: OCI AI Services
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
description: OCI Language、Speech、Vision、Document Understanding、Digital Assistant と関連する prebuilt AI を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

OCI AI Services は、text、音声、画像、document、会話などの specialized capability を managed API として提供する。model development team を用意せず application に AI を組み込める一方、supported language、file format、accuracy、custom training、region、quota を use case ごとに検証する。

このページでは Language、Speech、Vision、Document Understanding を specialized OCI AI API として扱い、Digital Assistant と Data Labeling は同じ AI solution で併用する隣接 service として掲載する。

## サービス比較

| Service                    | 主な入力              | 主な機能                                                                  | 向く用途                                                       |
| -------------------------- | --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| OCI Language               | text                  | sentiment、entity、key phrase、classification、PII、translation           | support ticket、feedback、document metadata、PII detection     |
| OCI Speech                 | audio / stream / text | batch / live speech-to-text、customization、text-to-speech                | call transcription、subtitle、voice interface                  |
| OCI Vision                 | image / video         | image classification、object detection、OCR、custom model、video analysis | inspection、asset tagging、visual search、stream monitoring    |
| OCI Document Understanding | PDF、TIFF、image      | OCR、table、key-value、document classification、custom model              | invoice、application form、contract metadata extraction        |
| Oracle Digital Assistant   | conversation          | intent、entity、skill、dialog flow、channel integration                   | flow を明示する task chatbot、customer / employee self-service |
| OCI Data Labeling          | image、text、document | label、bounding box、entity、key-value annotation                         | Vision / Language / Document custom model の dataset 作成      |

## OCI Language

pretrained model を API から利用する方法と、business-specific data で custom model を作る方法がある。short text と long document、supported language、entity type、batch size、PII category の差を確認する。

LLM で自由形式に text を解釈するより、固定 schema の sentiment / entity / classification が必要な場合に向く。生成文章や複雑な reasoning が必要なら [[cloud/oracle/ai/oci-enterprise-ai|OCI Generative AI]] と比較する。

## Specialized API と multimodal LLM の選択

| 観点     | Specialized AI service                                        | Generative / multimodal model                               |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Output   | field、label、timestamp、bounding box など定義済み schema     | 自由形式または prompt で指定する schema                     |
| 主な強み | domain-specific API、confidence、batch / stream、custom model | 複数 modality の理解、要約、reasoning、柔軟な instruction   |
| 評価     | field / class ごとの precision、recall、confidence threshold  | factuality、schema adherence、grounding、prompt variation   |
| 運用     | service-specific limit、format、language、custom training     | model version、token、context、guardrail、prompt regression |

固定した抽出・分類 contract、streaming、座標や timestamp が必要なら specialized service を先に評価する。複数種類の入力を横断して説明・要約・reasoning する場合は multimodal model を評価し、必要に応じて両者を組み合わせる。

## OCI Speech

file-based transcription、live transcription、customization、text-to-speech を提供する。音声 quality、speaker、background noise、domain vocabulary、language、sample rate が accuracy に影響する。

- raw audio と transcript の retention / access を分ける。
- timestamp と confidence score を downstream application に保持する。
- call recording の consent、PII、regional regulation を確認する。
- human review が必要な threshold を定義する。

## OCI Vision

pretrained / custom image analysis に加え、stored video と stream video analysis の documentation がある。camera stream の frame sampling、latency、network、false positive、face / biometric data の扱いを設計する。

visual anomaly detection と time-series anomaly detection は異なる。製造 image の defect は Vision、sensor series の anomaly は Data Science Operator などを評価する。

## OCI Document Understanding

OCR、table extraction、key-value extraction、document classification を提供する。PDF / image を受け取って text を出すだけでなく、document layout と field を business process に接続する service である。

- scan quality、rotation、handwriting、multi-page table、language を representative sample で測る。
- field confidence が低い場合の human review queue を作る。
- extracted value を型、range、master data と照合する。
- source document、extracted JSON、corrected value の lineage を残す。

## Oracle Digital Assistant

Digital Assistant は複数の skill を束ね、intent / entity と dialog flow で user task を完了させる platform である。Teams、Slack、Web、mobile、voice などの channel と、human agent transfer を重視する use case に向く。

LLM agent と比べて flow と state を明示しやすい。曖昧な質問への広い reasoning よりも、申請、照会、予約、support など定義済み task を確実に案内する場合に選ぶ。

## Anomaly Detection と Forecasting

standalone の [**OCI Anomaly Detection service は提供終了**](https://docs.oracle.com/en-us/iaas/Content/anomaly/using/home.htm)している。current OCI Data Science には、Anomaly Detection、Time-based Anomaly Detection、AI Forecast などの ADS Operator がある。新規構成では [[cloud/oracle/ai/oci-data-science|OCI Data Science]] の Operator または custom model を利用する。

Cost Anomaly Detection は OCI Billing の別機能であり、business / sensor time series を分析する汎用 AI service ではない。

## AI Accelerator Packs

OCI AI Accelerator Packs は単体の specialized AI API ではなく、複数の OCI service と application component をまとめた solution pack である。詳細と導入上の注意は [[cloud/oracle/ai/oracle-application-ai#oci-ai-accelerator-packs|Oracle Application AI の AI Accelerator Packs]]を参照する。

## 公式ドキュメント

- [OCI AI Services](https://www.oracle.com/artificial-intelligence/ai-services/)
- [OCI Language](https://docs.oracle.com/en-us/iaas/Content/language/using/home.htm)
- [OCI Speech](https://docs.oracle.com/en-us/iaas/Content/speech/home.htm)
- [OCI Vision](https://docs.oracle.com/en-us/iaas/Content/vision/using/home.htm)
- [OCI Document Understanding](https://docs.oracle.com/en-us/iaas/Content/document-understanding/using/home.htm)
- [Oracle Digital Assistant](https://docs.oracle.com/en-us/iaas/digital-assistant/doc/overview-digital-assistants-skills.html)
- [OCI Data Science Operators](https://docs.oracle.com/en-us/iaas/Content/data-science/using/operators.htm)
