"use client";

import Image from "next/image";
import OpenAI from "openai";
import { useEffect, useState } from "react";

interface GeneratedImage {
  url: string;
  prompt: string;
}

export default function AirbnbGenerator() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [activeGenerations, setActiveGenerations] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Charger la clé API depuis le localStorage au démarrage
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai-api-key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Sauvegarder la clé API dans le localStorage quand elle change
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("openai-api-key", apiKey);
    }
  }, [apiKey]);

  // Fonction pour encoder l'image de référence en base64
  const encodeImage = async (imagePath: string): Promise<string> => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Extraire seulement la partie base64 (sans le préfixe data:...)
          const base64Data = base64String.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'encodage de l'image de référence:",
        error
      );
      throw error;
    }
  };

  const generateImage = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your OpenAI key");
      return;
    }

    if (!prompt.trim()) {
      setError("Please describe the image you want to generate");
      return;
    }

    // Sauvegarder le prompt et vider le champ immédiatement
    const currentPrompt = prompt;
    setPrompt("");
    setError(null);

    // Incrémenter le compteur de générations actives
    setActiveGenerations((prev) => prev + 1);

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      // Encoder l'image de référence
      const referenceImageBase64 = await encodeImage("/airbnb.webp");

      // Prompt enrichi pour correspondre au style souhaité
      const enrichedPrompt = `Can you create me an image of ${currentPrompt} in this style.`;

      const response = await openai.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: enrichedPrompt },
              {
                type: "input_image",
                image_url: `data:image/webp;base64,${referenceImageBase64}`,
                detail: "high",
              },
            ],
          },
        ],
        tools: [{ type: "image_generation" }],
      });

      const imageData = response.output
        .filter((output) => output.type === "image_generation_call")
        .map((output) => output.result);

      if (imageData.length > 0) {
        const imageBase64 = imageData[0];
        const newImage = {
          url: `data:image/png;base64,${imageBase64}`,
          prompt: currentPrompt,
        };

        // Ajouter la nouvelle image à la liste existante
        setGeneratedImages((prev) => [...prev, newImage]);
      } else {
        setError(`Erreur lors de la génération de: "${currentPrompt}"`);
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      if (error.code === "invalid_api_key") {
        setError("Invalid API key. Check your OpenAI key.");
      } else if (error.code === "insufficient_quota") {
        setError("Insufficient quota. Check your OpenAI credits.");
      } else {
        setError(
          `Error generating "${currentPrompt}": ` +
            (error.message || "Unknown error")
        );
      }
    } finally {
      // Décrémenter le compteur de générations actives
      setActiveGenerations((prev) => prev - 1);
    }
  };

  const clearAllImages = () => {
    setGeneratedImages([]);
  };

  const downloadImage = async (
    imageUrl: string,
    prompt: string,
    index: number
  ) => {
    try {
      // Extraire les données base64 de l'URL data
      const base64Data = imageUrl.split(",")[1];
      const bytes = atob(base64Data);
      const byteArray = new Uint8Array(bytes.length);

      for (let i = 0; i < bytes.length; i++) {
        byteArray[i] = bytes.charCodeAt(i);
      }

      const blob = new Blob([byteArray], { type: "image/png" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Créer un nom de fichier basé sur le prompt
      const filename = `${prompt
        .replace(/[^a-zA-Z0-9]/g, "-")
        .substring(0, 30)}-${index + 1}.png`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  const downloadAllImages = async () => {
    for (let i = 0; i < generatedImages.length; i++) {
      await downloadImage(generatedImages[i].url, generatedImages[i].prompt, i);
      // Petit délai entre les téléchargements
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-red-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎨 AI Animation Illustration Generator
          </h1>
          <p className="text-gray-600 text-lg">
            Generate multiple illustrations in parallel
          </p>
          {activeGenerations > 0 && (
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              {activeGenerations} generation{activeGenerations > 1 ? "s" : ""}{" "}
              in progress
            </div>
          )}
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="space-y-6">
            {/* Clé API */}
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                OpenAI API Key *
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your key stays private and is only used in your browser
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Image Description *
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: an arm holding a dumbbell..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Field will clear immediately for next generation
              </p>
            </div>

            {/* Bouton de génération */}
            <button
              onClick={generateImage}
              disabled={!apiKey.trim() || !prompt.trim()}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all ${
                !apiKey.trim() || !prompt.trim()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 transform hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              ✨ Start Generation
            </button>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">❌ {error}</p>
          </div>
        )}

        {/* Images générées */}
        {generatedImages.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                🎨 Illustration Collection ({generatedImages.length})
              </h2>
              <div className="flex gap-2">
                {generatedImages.length > 1 && (
                  <button
                    onClick={downloadAllImages}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    📥 Download All
                  </button>
                )}
                <button
                  onClick={clearAllImages}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>
            <div
              className={`grid gap-6 ${
                generatedImages.length === 1
                  ? "grid-cols-1 justify-items-center"
                  : generatedImages.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {generatedImages.map((image, index) => (
                <div
                  key={index}
                  className="text-center bg-gray-50 p-4 rounded-lg"
                >
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 font-medium">
                      &quot;{image.prompt}&quot;
                    </p>
                  </div>
                  <Image
                    src={image.url}
                    alt={`Image: ${image.prompt}`}
                    width={400}
                    height={400}
                    className="mx-auto rounded-lg shadow-lg"
                  />
                  <button
                    onClick={() =>
                      downloadImage(image.url, image.prompt, index)
                    }
                    className="mt-3 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    📥 Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
