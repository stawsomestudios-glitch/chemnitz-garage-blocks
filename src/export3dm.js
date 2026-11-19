import * as THREE from 'three'

// Saves the 3D model, as it is on screen, as a Rhino 8 file (.3dm).
// Everything becomes a mesh in metres, Z up, on layers by kind (garages, ribbon, elements, context …).
// Garage titles become text dots. The Rhino library (rhino3dm, by McNeel) is only loaded when you press the button.

let rhinoReady = null
async function loadRhino() {
  if (!rhinoReady) {
    rhinoReady = Promise.all([import('rhino3dm/rhino3dm.module.js'), import('rhino3dm/rhino3dm.wasm?url')]).then(([lib, wasm]) =>
      lib.default({ locateFile: () => wasm.default }),
    )
  }
  return rhinoReady
}

// three.js has Y up and Z pointing south; Rhino has Z up and Y pointing north.
// Mesh.createFromThreejsJSON turns Y up into Z up by itself, so nothing more is needed here.

const rgba = (c) => ({ r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255), a: 255 })
const srgb = (c) => c.clone().convertLinearToSRGB()

// The layer of an object: its own userData.layer, or the nearest parent's.
function layerOf(o) {
  for (let p = o; p; p = p.parent) if (p.userData?.layer) return p.userData.layer
  return 'Other'
}
function skipped(o) {
  for (let p = o; p; p = p.parent) if (p.userData?.noExport || p.visible === false) return true
  return false
}

// A copy of the geometry, moved into place, with only what Rhino needs.
// With `tris`, only those triangles, and only the points they use.
function placed(geometry, matrix, tris) {
  const src = geometry.attributes.position
  const index = tris ?? (geometry.index ? Array.from(geometry.index.array) : [...Array(src.count).keys()])
  const remap = new Map()
  const pos = []
  const idx = index.map((v) => {
    if (!remap.has(v)) {
      remap.set(v, remap.size)
      pos.push(src.getX(v), src.getY(v), src.getZ(v))
    }
    return remap.get(v)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.applyMatrix4(matrix)
  g.computeVertexNormals()
  return g
}

export async function export3dm({ scene, dots, filename }) {
  const rhino = await loadRhino()
  const doc = new rhino.File3dm()
  doc.settings().modelUnitSystem = rhino.UnitSystem.Meters

  const layers = new Map()
  const layer = (name, colour) => {
    if (!layers.has(name)) {
      const l = new rhino.Layer()
      l.name = name
      l.color = colour ? rgba(colour) : { r: 120, g: 120, b: 120, a: 255 }
      layers.set(name, doc.layers().add(l))
    }
    return layers.get(name)
  }
  const add = (geometry, layerName, name, colour) => {
    const mesh = rhino.Mesh.createFromThreejsJSON({ data: geometry.toJSON().data })
    geometry.dispose()
    if (!mesh) return
    const a = new rhino.ObjectAttributes()
    a.layerIndex = layer(layerName, colour)
    if (name) a.name = name
    if (colour) {
      a.colorSource = rhino.ObjectColorSource.ColorFromObject
      a.objectColor = rgba(colour)
    }
    doc.objects().add(mesh, a)
  }

  scene.updateMatrixWorld(true)
  const meshes = []
  scene.traverse((o) => o.isMesh && !skipped(o) && meshes.push(o))
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  let count = 0

  for (const o of meshes) {
    const lname = layerOf(o)
    const base = o.material?.color ? srgb(o.material.color) : null

    if (o.isInstancedMesh) {
      // one Rhino object per instance (each garage, door …), named and coloured like on screen
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m)
        m.premultiply(o.matrixWorld)
        if (o.instanceColor) o.getColorAt(i, c)
        add(placed(o.geometry, m), lname, o.userData.names?.[i], o.instanceColor ? srgb(c) : base)
        count++
      }
      continue
    }

    if (o.userData.pieces) {
      // the ribbon: one Rhino object per piece, named by its number and kind
      const { piece, names, colour, colours } = o.userData.pieces
      const index = o.geometry.index.array
      const byPiece = new Map()
      for (let t = 0; t < index.length; t += 3) {
        const k = piece[index[t]]
        if (!byPiece.has(k)) byPiece.set(k, [])
        byPiece.get(k).push(index[t], index[t + 1], index[t + 2])
      }
      for (const [k, tri] of byPiece) {
        add(placed(o.geometry, o.matrixWorld, tri), lname, names[k] ?? 'path', new THREE.Color(colours?.[k] ?? colour))
        count++
      }
      continue
    }

    add(placed(o.geometry, o.matrixWorld), lname, o.userData.name, base)
    count++
  }

  // garage titles as text dots, above each garage
  const dotLayer = layer('Titles', new THREE.Color('#222222'))
  for (const d of dots) {
    const dot = new rhino.TextDot(d.text, [d.x, d.y, d.z])
    const a = new rhino.ObjectAttributes()
    a.layerIndex = dotLayer
    a.name = d.text
    doc.objects().add(dot, a)
  }

  const options = new rhino.File3dmWriteOptions()
  options.version = 8 // Rhino 8
  const bytes = doc.toByteArrayOptions(options)
  doc.delete()

  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 4000)
  return { objects: count, dots: dots.length, bytes: bytes.length }
}
