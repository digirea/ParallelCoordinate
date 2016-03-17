
(function(global){
    'use strict';

    // parcoords
    var parcoords;
    var usr;

    // webgl render
    var glContext = {};
    var mat = new matIV();
    var weight = [];

    // other private variable
    var targetData = null;
    var density = true;
    var colormap = null;

    // window size
    var canvasAreaWidth = 1000;
    var canvasAreaHeight = 700;

    var sph = new SPHLoader();

    window.addEventListener('load', function(){
        var prev = {prevType: null, glforeground: null, glbrush: null};
        var dataval = null;
        var linecount;
        var dimensionTitles = {};

        var densityCheck = document.getElementById('density');
        densityCheck.addEventListener('change', redraw, false);
        var densityNormal = document.getElementById('densityNormal');
        densityNormal.addEventListener('change', function(){if(densityCheck.checked){redraw();}}, false);
        var densityRange = 95;
        var fileInput = document.getElementById('file');
        fileInput.addEventListener('change', fileUpload, false);
        var logScale = document.getElementById('logScale');
        logScale.addEventListener('change', function(){if(prev.prevType != null){useAxes();}}, false);

        new ColorMap(document.getElementById('pickercanvas'), function(e){
            colormap = e;
            redraw();
        });

        window.addEventListener('resize', windowResize, false);
        windowResize();
        function windowResize(eve){
            var tw = window.innerWidth;
            var th = window.innerHeight;
            canvasAreaWidth = tw * 0.85;
            canvasAreaHeight = th * 0.7;
        }

        function fileUpload(eve){
            var file = eve.target.files[0];
            var reader = new FileReader();
            reader.onload = function(eve) {
                var data = eve.target.result;
                var p = sph.isSPH(data);
                if(p.type){
                    targetData = sph.parse(data);
                }else{
                    targetData = convertCSV(eve.target.result);
                }
                useAxes();
                setTimeout(function(){
                    var e = document.createElement('script');
                    document.body.appendChild(e);
                    e.src = './javascripts/lib/cpick.js';
                }, 200);
            };
            reader.readAsText(file, "utf-8");
        }

        function redraw(){
            if(prev.prevType != null){
                if(prev.glbrush != null && prev.glbrush.data != null){
                    glRender('glbrush', prev.glbrush.data, prev.glbrush.lines, prev.glbrush.left, prev.glbrush.right);
                }
                glRender('glforeground', prev.glforeground.data, prev.glforeground.lines, prev.glforeground.left, prev.glforeground.right);
            }
        }
        global.redrawing = redraw;

        function convertCSV(data){
            var header, temp, dest, rowcell;
            var i, j, k, l, m;
            dest = [];
            if(data === null || data === undefined || data === ''){return;}
            temp = data.split('\n');
            if(temp === null || temp === undefined || !temp.length || temp.length < 3){return;}
            header = temp[0].split(',');
            k = true;
            for(i = 0, j = header.length; i < j; ++i){
                k = k && (header[i].match(/^(-\d|\.)+$/));
                if(!k){break;}
            }
            if(!k){ // use header strings
                for(i = 1, j = temp.length; i < j; ++i){
                    m = i - 1;
                    dest[m] = {};
                    rowcell = temp[i].split(',');
                    for(l = 0; l < header.length; ++l){
                        dest[m][header[l]] = rowcell[l];
                    }
                }
            }else{
                for(i = 0, j = temp.length; i < j; ++i){
                    dest[i] = {};
                    rowcell = temp[i].split(',');
                    for(l = 0; l < rowcell.length; ++l){
                        dest[m][i] = rowcell[l];
                    }
                }
            }
            return dest;
        }

        function useAxes(){
            var i, j, k, l;
            param();
            if(targetData == null){return;}

            beginDraw(targetData);
            function beginDraw(data){
                if(data.length < 3){console.log('invalid data:' + data); return;}
                dimensionTitles = {};
                dataval = [];
                if(Array.isArray(data[0])){ // csv 先頭行がタイトルではない
                    for(i = 0, j = data[0].length; i < j; ++i){
                        dimensionTitles[i] = i;
                    }
                    for(i = 0, j = data.length; i < j; ++i){
                        dataval[i] = [];
                        for(k = 0, l = data[i].length; k < l; ++k){
                            dataval[i][k] = data[i][k];
                        }
                    }
                }else{ // csv 先頭行がタイトルになっており配列の中に javascript オブジェクトが入っているケース
                    i = 0;
                    for(j in data[0]){
                        dimensionTitles[i] = j;
                        i++;
                    }
                    for(i = 0, j = data.length; i < j; ++i){
                        dataval[i] = [];
                        for(k in dimensionTitles){
                            dataval[i][k] = data[i][dimensionTitles[k]];
                        }
                    }
                }
                linecount = dataval.length;
                parcoords = d3.parcoords({dimensionTitles: dimensionTitles, usr: usr})('#example')
                    .data(dataval)
                    .mode("queue")
                    .width(canvasAreaWidth)
                    .height(canvasAreaHeight);

                glInitialize();
                parcoords.render()        // ラインを描画する
                    .createAxes()         // 目盛を生成する
                    .reorderable()        // 軸の並び替え有効化
                    .brushMode("1D-axes") // 抽出のやり方
                    .interactive();       // 常時更新
            }
        }

        function param(){
            usr = {
                logScale: logScale.checked,
                glRender: glRender
            };
            reset();
        }

        function reset(){
            var e = document.getElementById('example');
            if(e){
                var tmp = document.createElement('div');
                tmp.style.display = 'none';
                document.body.appendChild(tmp);
                tmp.appendChild(document.getElementById('glforeground'));
                tmp.appendChild(document.getElementById('glbrush'));
                e.parentNode.removeChild(e);
                e = document.createElement('div');
                e.id = 'example';
                e.className = 'parcoords';
                document.getElementById('container').appendChild(e);
                e.appendChild(document.getElementById('glforeground'));
                e.appendChild(document.getElementById('glbrush'));
                document.body.removeChild(tmp);
            }else{
                e = document.createElement('div');
                e.id = 'example';
                e.className = 'parcoords';
                document.getElementById('container').appendChild(e);
            }
        }

        function glInitialize(){
            if(parcoords == null){return;}
            if(!document.getElementById('glforeground')){
                var e = parcoords.selection.node();
                var m = parcoords.canvas.marks;
                var c = document.createElement('canvas');
                canvasAttCopy(c, 'glbrush', m);
                glContext['glbrush'].color           = [0.3, 0.9, 0.6, 0.1]; // brush line
                glContext['glbrush'].lowColor        = [0.0, 0.0, 0.1];
                glContext['glbrush'].middleLowColor  = [0.0, 0.1, 0.8];
                glContext['glbrush'].middleColor     = [0.1, 1.0, 0.8];
                glContext['glbrush'].middleHighColor = [0.8, 1.0, 0.1];
                glContext['glbrush'].highColor       = [1.0, 0.1, 0.1];
                e.insertBefore(c, e.firstChild);
                c = document.createElement('canvas');
                canvasAttCopy(c, 'glforeground', m);
                glContext['glforeground'].color           = [0.9, 0.3, 0.6, 0.1]; // foreground line
                glContext['glforeground'].lowColor        = [0.0, 0.0, 0.1];
                glContext['glforeground'].middleLowColor  = [0.0, 0.1, 0.8];
                glContext['glforeground'].middleColor     = [0.1, 1.0, 0.8];
                glContext['glforeground'].middleHighColor = [0.8, 1.0, 0.1];
                glContext['glforeground'].highColor       = [1.0, 0.1, 0.1];
                e.insertBefore(c, e.firstChild);
                
                fromArrayToPicker();
            }

            function canvasAttCopy(c, name, m){
                c.id = name;
                c.style.cssText = m.style.cssText;
                c.width = m.width;
                c.height = m.height;

                if(glContext[name] == null){
                    glContext[name] = {
                        gl: c.getContext('webgl'),
                        color: [0.2, 0.2, 0.2, 0.1],
                        pl: new prgLocations(),
                        plp: new prgLocations(),
                        plf: new prgLocations()
                    };
                    glContext[name].texture = glContext[name].gl.createTexture();
                }
            }
        }

        function fromPickerToArray(){
            var i, a, c, e, r, g, b;
            a = [
                'glforeground',
                'glbrush'
            ];
            for(i = 1; i <= 2; ++i){
                e = document.getElementById('lineColor' + i);
                c = e.style.backgroundColor.match(/\d+/g);
                r = parseInt(c[0]) / 255;
                g = parseInt(c[1]) / 255;
                b = parseInt(c[2]) / 255;
                glContext[a[i - 1]].color = [r, g, b, 0.1];
            }
        }

        function fromArrayToPicker(){
            var i, a, c, e, r, g, b;
            a = [
                'glforeground',
                'glbrush'
            ];
            for(i = 1; i <= 2; ++i){
                r = zeroPadding(new Number(parseInt(glContext[a[i - 1]].color[0] * 255)).toString(16), 2);
                g = zeroPadding(new Number(parseInt(glContext[a[i - 1]].color[1] * 255)).toString(16), 2);
                b = zeroPadding(new Number(parseInt(glContext[a[i - 1]].color[2] * 255)).toString(16), 2);
                e = document.getElementById('lineColor' + i).value = '#' + r + g + b;
            }
        }
        
        function prgLocations(){
            this.prg = null;
            this.vs  = null;
            this.fs  = null;
            this.vSource = '';
            this.fSource = '';
            this.attL = [];
            this.attS = [];
            this.uniL = {};
            this.horizonBuffer = null;
            this.verticalBuffer = null;
            this.bufferWidth = 0;
            this.bufferHeight = 0;
        }

        function glRender(target, data, lines, left, right){
            prev.prevType = target;
            prev[target] = {target: target, data: data, lines: lines, left: left, right: right};
            if(glContext[target].gl == null){alert('webgl initialize error'); return;}

            var gc = glContext[target];
            var gl = gc.gl;
            var vPosition, vboL;
            var polyPosition = [];
            var vPolyPosition, vboPL;
            var width = gl.canvas.width;
            var height = gl.canvas.height;
            var ext;
            ext = gl.getExtension('OES_texture_float');
            var darkness = (target.match(/brush/));
            var darkAlpha = 0.5;

            if(target.match(/foreground/)){
                glContext['glbrush'].gl.viewport(0, 0, width, height);
                glContext['glbrush'].gl.clearColor(0.0, 0.0, 0.0, 0.0);
                glContext['glbrush'].gl.clear(glContext['glbrush'].gl.COLOR_BUFFER_BIT);
            }else{
                if(data == null){
                    glContext['glbrush'].gl.viewport(0, 0, width, height);
                    glContext['glbrush'].gl.clearColor(0.0, 0.0, 0.0, 0.0);
                    glContext['glbrush'].gl.clear(glContext['glbrush'].gl.COLOR_BUFFER_BIT);
                }
            }

            if(gc.pl.prg == null){
                gc.pl.vSource = '';
                gc.pl.vSource += 'attribute vec2 position;';
                gc.pl.vSource += 'uniform mat4 matrix;';
                gc.pl.vSource += 'void main(){';
                gc.pl.vSource += '    gl_Position = matrix * vec4(position, 0.0, 1.0);';
                gc.pl.vSource += '}';

                gc.pl.fSource = '';
                gc.pl.fSource += 'precision mediump float;';
                gc.pl.fSource += 'uniform vec4 color;';
                gc.pl.fSource += 'uniform float density;';
                gc.pl.fSource += 'void main(){';
                gc.pl.fSource += '    if(density > 0.0){';
                gc.pl.fSource += '        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);';
                gc.pl.fSource += '    }else{';
                gc.pl.fSource += '        gl_FragColor = color;';
                gc.pl.fSource += '    }';
                gc.pl.fSource += '}';

                gc.pl.vs = create_shader(gl, gc.pl.vSource, gl.VERTEX_SHADER);
                gc.pl.fs = create_shader(gl, gc.pl.fSource, gl.FRAGMENT_SHADER);
                gc.pl.prg = create_program(gl, gc.pl.vs, gc.pl.fs);

                gc.pl.attL = [gl.getAttribLocation(gc.pl.prg, 'position')];
                gc.pl.attS = [2];
                gc.pl.uniL = {
                    matrix: gl.getUniformLocation(gc.pl.prg, 'matrix'),
                    color: gl.getUniformLocation(gc.pl.prg, 'color'),
                    density: gl.getUniformLocation(gc.pl.prg, 'density')
                };

                gc.plp.vSource = '';
                gc.plp.vSource += 'attribute vec3 position;';
                gc.plp.vSource += 'void main(){';
                gc.plp.vSource += '    gl_Position = vec4(position, 1.0);';
                gc.plp.vSource += '}';

                gc.plp.fSource = '';
                gc.plp.fSource += 'precision mediump float;';
                gc.plp.fSource += 'uniform vec2 resolution;';
                gc.plp.fSource += 'uniform bool horizontal;';
                gc.plp.fSource += 'uniform float weight[30];';
                gc.plp.fSource += 'uniform sampler2D texture;';
                gc.plp.fSource += 'void main(){';
                gc.plp.fSource += '    vec2 tFrag = 1.0 / resolution;';
                gc.plp.fSource += '    vec2 fc = gl_FragCoord.st;';
                gc.plp.fSource += '    vec4 destColor = texture2D(texture, fc) * weight[0];';
                gc.plp.fSource += '    if(horizontal){';
                gc.plp.fSource += '        for(int i = 1; i < 30; ++i){';
                gc.plp.fSource += '            destColor += texture2D(texture, (fc + vec2( float(i), 0.0)) * tFrag) * weight[i];';
                gc.plp.fSource += '            destColor += texture2D(texture, (fc + vec2(-float(i), 0.0)) * tFrag) * weight[i];';
                gc.plp.fSource += '        }';
                gc.plp.fSource += '    }else{';
                gc.plp.fSource += '        for(int i = 1; i < 30; ++i){';
                gc.plp.fSource += '            destColor += texture2D(texture, (fc + vec2(0.0,  float(i))) * tFrag) * weight[i];';
                gc.plp.fSource += '            destColor += texture2D(texture, (fc + vec2(0.0, -float(i))) * tFrag) * weight[i];';
                gc.plp.fSource += '        }';
                gc.plp.fSource += '    }';
                gc.plp.fSource += '    gl_FragColor = destColor;';
                gc.plp.fSource += '}';

                gc.plp.vs = create_shader(gl, gc.plp.vSource, gl.VERTEX_SHADER);
                gc.plp.fs = create_shader(gl, gc.plp.fSource, gl.FRAGMENT_SHADER);
                gc.plp.prg = create_program(gl, gc.plp.vs, gc.plp.fs);

                gc.plp.attL = [gl.getAttribLocation(gc.plp.prg, 'position')];
                gc.plp.attS = [3];
                gc.plp.uniL = {
                    resolution: gl.getUniformLocation(gc.plp.prg, 'resolution'),
                    horizontal: gl.getUniformLocation(gc.plp.prg, 'horizontal'),
                    weight:     gl.getUniformLocation(gc.plp.prg, 'weight'),
                    texture:    gl.getUniformLocation(gc.plp.prg, 'texture')
                };

                gc.plf.vSource = '';
                gc.plf.vSource += 'attribute vec3 position;';
                gc.plf.vSource += 'void main(){';
                gc.plf.vSource += '    gl_Position = vec4(position, 1.0);';
                gc.plf.vSource += '}';

                gc.plf.fSource = '';
                gc.plf.fSource += 'precision mediump float;';
                gc.plf.fSource += 'uniform vec4 color;';
                gc.plf.fSource += 'uniform vec2 resolution;';
                gc.plf.fSource += 'uniform sampler2D texture;';
                gc.plf.fSource += 'uniform float density;';
                gc.plf.fSource += 'uniform sampler2D colorMap;';
                gc.plf.fSource += 'void main(){';
                gc.plf.fSource += '    if(density > 0.0){';
                gc.plf.fSource += '        vec4 c = color;';
                gc.plf.fSource += '        vec2 texcoord = gl_FragCoord.st / resolution;';
                gc.plf.fSource += '        vec4 smpColor = texture2D(texture, texcoord);';
                gc.plf.fSource += '        float range = smpColor.a / density;';
                gc.plf.fSource += '        vec4 tex = texture2D(colorMap, vec2(range, 0.0));'; // temp
                gc.plf.fSource += '        gl_FragColor = vec4(tex.rgb, range * 3.0);';
                gc.plf.fSource += '    }else{';
                gc.plf.fSource += '        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);';
                gc.plf.fSource += '    }';
                gc.plf.fSource += '}';

                gc.plf.vs = create_shader(gl, gc.plf.vSource, gl.VERTEX_SHADER);
                gc.plf.fs = create_shader(gl, gc.plf.fSource, gl.FRAGMENT_SHADER);
                gc.plf.prg = create_program(gl, gc.plf.vs, gc.plf.fs);

                gc.plf.attL = [gl.getAttribLocation(gc.plf.prg, 'position')];
                gc.plf.attS = [3];
                gc.plf.uniL = {
                    color: gl.getUniformLocation(gc.plf.prg, 'color'),
                    resolution: gl.getUniformLocation(gc.plf.prg, 'resolution'),
                    texture: gl.getUniformLocation(gc.plf.prg, 'texture'),
                    density: gl.getUniformLocation(gc.plf.prg, 'density'),
                    colorMap: gl.getUniformLocation(gc.plf.prg, 'colorMap')
                };

                (function(){
                    var t = 0.0;
                    for(var i = 0; i < 30; i++){
                        var r = 1.0 + 2.0 * i;
                        var w = Math.exp(-0.5 * (r * r) / 150.0);
                        weight[i] = w;
                        if(i > 0){w *= 2.0;}
                        t += w;
                    }
                    for(i = 0; i < weight.length; i++){
                        weight[i] /= t;
                    }
                })();

                (function(){
                    var i;
                    for(i = 1; i < width; i *= 2){}
                    gc.plp.bufferWidth = i;
                    for(i = 1; i < height; i *= 2){}
                    gc.plp.bufferHeight = i;
                })();
                gc.plp.horizonBuffer  = create_framebuffer(gl, ext, gc.plp.bufferWidth, gc.plp.bufferHeight);
                gc.plp.verticalBuffer = create_framebuffer(gl, ext, gc.plp.bufferWidth, gc.plp.bufferHeight);
            }else{
                // 初回ロードではない場合色取得
                fromPickerToArray();
            }

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, gc.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colormap.canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.activeTexture(gl.TEXTURE0);

            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
            gl.lineWidth(1.5);
            gl.useProgram(gc.pl.prg);

            if(data == null){return;}

            var vMatrix = mat.identity(mat.create());
            var pMatrix = mat.identity(mat.create());
            var vpMatrix = mat.identity(mat.create());

            vPosition = create_vbo(gl, data);
            vboL = [vPosition];

            polyPosition = [
                -1.0,  1.0,  0.0,
                 1.0,  1.0,  0.0,
                -1.0, -1.0,  0.0,
                 1.0, -1.0,  0.0
            ];
            vPolyPosition = create_vbo(gl, polyPosition);
            vboPL = [vPolyPosition];

            mat.lookAt(
                [0.0, 0.0, 1.0],
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                vMatrix
            );
            mat.ortho(
                0,
                width,
                0,
                height,
                0.5,
                5.0,
                pMatrix
            );
            mat.multiply(pMatrix, vMatrix, vpMatrix);

            density = densityCheck.checked;
            if(densityNormal.checked){
                lines *= (101 - densityRange) / 100 * 0.5;
            }else{
                lines = linecount * (101 - densityRange) / 100 * 0.5;
            }
            if(density){
                // first scene to vertical buffer
                gl.bindFramebuffer(gl.FRAMEBUFFER, gc.plp.verticalBuffer.framebuffer);
                gl.viewport(0, 0, gc.plp.bufferWidth, gc.plp.bufferHeight);
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                set_attribute(gl, vboL, gc.pl.attL, gc.pl.attS);
                gl.uniformMatrix4fv(gc.pl.uniL.matrix, false, vpMatrix);
                gl.uniform4fv(gc.pl.uniL.color, gc.color);
                gl.uniform1f(gc.pl.uniL.density, lines);
                gl.drawArrays(gl.LINES, 0, data.length / 2);

                // horizon blur
                gl.bindFramebuffer(gl.FRAMEBUFFER, gc.plp.horizonBuffer.framebuffer);
                gl.bindTexture(gl.TEXTURE_2D, gc.plp.verticalBuffer.texture);
                gl.viewport(0, 0, gc.plp.bufferWidth, gc.plp.bufferHeight);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.useProgram(gc.plp.prg);
                set_attribute(gl, vboPL, gc.plp.attL, gc.plp.attS);
                gl.uniform2fv(gc.plp.uniL.resolution, [gc.plp.bufferWidth, gc.plp.bufferHeight]);
                gl.uniform1i(gc.plp.uniL.horizontal, true);
                gl.uniform1fv(gc.plp.uniL.weight, weight);
                gl.uniform1i(gc.plp.uniL.texture, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                // vertical blur
                gl.bindFramebuffer(gl.FRAMEBUFFER, gc.plp.verticalBuffer.framebuffer);
                gl.bindTexture(gl.TEXTURE_2D, gc.plp.horizonBuffer.texture);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.uniform1i(gc.plp.uniL.horizontal, false);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                // final scene
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.bindTexture(gl.TEXTURE_2D, gc.plp.verticalBuffer.texture);
                gl.viewport(0, 0, width, height);
                gl.clearColor(0.0, 0.0, 0.0, darkness ? darkAlpha : 0.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.useProgram(gc.plf.prg);
                set_attribute(gl, vboPL, gc.plf.attL, gc.plf.attS);
                gl.uniform4fv(gc.plf.uniL.color, gc.color);
                gl.uniform2fv(gc.plf.uniL.resolution, [width, height]);
                gl.uniform1i(gc.plf.uniL.texture, 0);
                gl.uniform1f(gc.plf.uniL.density, lines);
                gl.uniform1i(gc.plf.uniL.colorMap, 2);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            }else{
                gl.viewport(0, 0, width, height);
                gl.clearColor(0.0, 0.0, 0.0, darkness ? darkAlpha : 0.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, width, height);
                gl.clear(gl.COLOR_BUFFER_BIT);
                set_attribute(gl, vboL, gc.pl.attL, gc.pl.attS);
                gl.uniformMatrix4fv(gc.pl.uniL.matrix, false, vpMatrix);
                gl.uniform4fv(gc.pl.uniL.color, gc.color);
                gl.uniform1f(gc.pl.uniL.density, -1.0);
                gl.drawArrays(gl.LINES, 0, data.length / 2);
            }
            gl.flush();
        }

    }, false);

    function zeroPadding(n, c){
        return (new Array(c + 1).join('0') + n).slice(-c);
    }
})(this);

