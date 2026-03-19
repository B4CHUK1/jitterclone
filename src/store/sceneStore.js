// src/store/sceneStore.js
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useSceneStore = create(immer((set) => ({
  duration: 3000,
  elements: [],
  // Shape d'un élément :
  // {
  //   id: 'el_1',
  //   type: 'image',
  //   src: 'data:image/...',        // base64
  //   naturalWidth: 1200,
  //   naturalHeight: 800,
  //   fit: 'contain',              // 'contain' | 'cover' | 'none'
  //   properties: {
  //     x:        { value: 100, keyframes: [] },
  //     y:        { value: 80,  keyframes: [] },
  //     width:    { value: 400, keyframes: [] },
  //     height:   { value: 266, keyframes: [] },
  //     rotation: { value: 0,   keyframes: [] }, // degrés
  //     opacity:  { value: 1,   keyframes: [] }, // 0–1
  //     scaleX:   { value: 1,   keyframes: [] }, // géré par Konva Transformer
  //     scaleY:   { value: 1,   keyframes: [] },
  //   }
  // }

  addElement: (element) => set((state) => {
    state.elements.push(element)
  }),

  updateProperty: (id, prop, value) => set((state) => {
    const el = state.elements.find(e => e.id === id)
    if (el) el.properties[prop].value = value
  }),

  updateProperties: (id, updates) => set((state) => {
    const el = state.elements.find(e => e.id === id)
    if (el) {
      Object.entries(updates).forEach(([prop, value]) => {
        if (el.properties[prop]) el.properties[prop].value = value
      })
    }
  }),

  updateFit: (id, fit) => set((state) => {
    const el = state.elements.find(e => e.id === id)
    if (el) el.fit = fit
  }),
})))

export default useSceneStore
