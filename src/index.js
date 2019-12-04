import {
    Matrix4,
    Cartesian3,
    Cartographic,
    Cesium3DTileset,
    createWorldTerrain,
    IonResource,
    knockout,
    HeadingPitchRange,
    Model,
    Viewer,
    viewerCesium3DTilesInspectorMixin
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./css/main.css";
/*---------------------------------------------------------------------------------------*/
// 说明文章在这里：icon cesium-notes/icon 解决Cesium1.50对gltf2.0 3dtiles数据读取的问题/
// https://zhuanlan.zhihu.com/p/46189487
// https://www.jianshu.com/p/e0e0a62c5726

var fixGltf = function (gltf) {
    if (!gltf.extensionsUsed) {
        return;
    }

    var v = gltf.extensionsUsed.indexOf('KHR_technique_webgl');
    var t = gltf.extensionsRequired.indexOf('KHR_technique_webgl');
    // 中招了。。
    if (v !== -1) {
        gltf.extensionsRequired.splice(t, 1, 'KHR_techniques_webgl');
        gltf.extensionsUsed.splice(v, 1, 'KHR_techniques_webgl');
        gltf.extensions = gltf.extensions || {};
        gltf.extensions['KHR_techniques_webgl'] = {};
        gltf.extensions['KHR_techniques_webgl'].programs = gltf.programs;
        gltf.extensions['KHR_techniques_webgl'].shaders = gltf.shaders;
        gltf.extensions['KHR_techniques_webgl'].techniques = gltf.techniques;
        var techniques = gltf.extensions['KHR_techniques_webgl'].techniques;

        gltf.materials.forEach(function (mat, index) {
            gltf.materials[index].extensions || (gltf.materials[index].extensions = {
                KHR_technique_webgl: {}
            }); // vtxf 181025
            gltf.materials[index].extensions['KHR_technique_webgl'].values = gltf.materials[index].values;
            gltf.materials[index].extensions['KHR_techniques_webgl'] = gltf.materials[index].extensions['KHR_technique_webgl'];

            var vtxfMaterialExtension = gltf.materials[index].extensions['KHR_techniques_webgl'];
            vtxfMaterialExtension.technique || (vtxfMaterialExtension.technique = gltf.materials[index].technique); // vtxf 181025


            for (var value in vtxfMaterialExtension.values) {
                var us = techniques[vtxfMaterialExtension.technique].uniforms;
                for (var key in us) {
                    if (us[key] === value) {
                        vtxfMaterialExtension.values[key] = vtxfMaterialExtension.values[value];
                        delete vtxfMaterialExtension.values[value];
                        break;
                    }
                }
            };
        });

        techniques.forEach(function (t) {
            for (var attribute in t.attributes) {
                var name = t.attributes[attribute];
                t.attributes[attribute] = t.parameters[name];
            };

            for (var uniform in t.uniforms) {
                var name = t.uniforms[uniform];
                t.uniforms[uniform] = t.parameters[name];
            };
        });
    }
}

Object.defineProperties(Model.prototype, {
    _cachedGltf: {
        set: function (value) {
            this._vtxf_cachedGltf = value;
            if (this._vtxf_cachedGltf && this._vtxf_cachedGltf._gltf) {
                fixGltf(this._vtxf_cachedGltf._gltf);
            }
        },
        get: function () {
            return this._vtxf_cachedGltf;
        }
    }
});
/*---------------------------------------------------------------------------------------*/
// This is simplified version of Cesium's Getting Started tutorial.
// See https://cesium.com/docs/tutorials/getting-started/ for more details.


var viewer = new Viewer('cesiumContainer', {
    shadows: false,
    terrainProvider: createWorldTerrain()
});
// viewer.extend(viewerCesium3DTilesInspectorMixin);
viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.globe.enableLighting = false;
viewer.scene.globe.show = false;

var viewModel = {
    height: 0
};

knockout.track(viewModel);

var toolbar = document.getElementById('toolbar');
knockout.applyBindings(viewModel, toolbar);

viewer._cesiumWidget._creditContainer.style.display = "none";//隐藏版权信息

var tileset = new Cesium3DTileset({
    url: '/data/Data/Tile_+000_+000/tileset.json'//' / data / tileset.json '

});
tileset.readyPromise.then(function (tileset) {
    viewer.scene.primitives.add(tileset);
    viewer.zoomTo(tileset, new HeadingPitchRange(0.0, -0.5, tileset.boundingSphere.radius * 2.0));
}).otherwise(function (error) {
    console.log(error);
});

knockout.getObservable(viewModel, 'height').subscribe(function (height) {
    height = Number(height);
    if (isNaN(height)) {
        return;
    }

    var cartographic = Cartographic.fromCartesian(tileset.boundingSphere.center);
    var surface = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
    var offset = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, height);
    var translation = Cartesian3.subtract(offset, surface, new Cartesian3());
    tileset.modelMatrix = Matrix4.fromTranslation(translation);
});