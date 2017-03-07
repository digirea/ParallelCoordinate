
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
    var canvasAreaWidth = 800;
    var canvasAreaHeight = 500;

    var sph = new SPHLoader();
    var issph = null;

    window.addEventListener('load', function(){
        var prev = {prevType: null, glforeground: null, glbrush: null};
        var dataval = null;
        var dataparam = null;
        var linecount;
        var colcount;
        var dimensionTitles = {};
        var data = [], params = [];

        var bottomArea = document.getElementById("ui_layer").getBoundingClientRect();
        canvasAreaWidth = Math.max(800, document.body.clientWidth - 150);
        canvasAreaHeight = Math.max(500, document.body.clientHeight - (bottomArea.bottom - bottomArea.top) - 100);

        var densityCheck = document.getElementById('density');
        densityCheck.addEventListener('change', redraw, false);
        var densityNormal = document.getElementById('densityNormal');
        densityNormal.addEventListener('change', function(){if(densityCheck.checked){redraw();}}, false);
        var densityRange = 95;
        var fileInput = document.getElementById('file');
        fileInput.addEventListener('change', fileUpload, false);
        var logScale = document.getElementById('logScale');
        logScale.addEventListener('change', function(){
            if(prev.prevType != null){
                if(dataparam && Object.prototype.toString.call(dataparam) === '[object Array]' && dataparam.length > 0 && logScale.checked){
                    var f = false;
                    for(var i = 0, j = dataparam.length; i < j; ++i){
                        f = f || dataparam[i].min <= 0.0;
                    }
                    if(f){
                        alert('データにゼロまたは負数が含まれています。\nlog scale モードではゼロや負数はデータが非表示または喪失することがあります。');
                    }
                }
                reset();
                useAxes();
            }
        }, false);

        new ColorMap(document.getElementById('pickercanvas'), function(e){
            colormap = e;
            redraw();
        });

        window.addEventListener('resize', windowResize, false);
        windowResize();
        function windowResize(eve){
            var tw = window.innerWidth;
            var th = window.innerHeight;
            var bottomArea = document.getElementById("ui_layer").getBoundingClientRect();
            canvasAreaWidth = Math.max(800, document.body.clientWidth - 150);
            canvasAreaHeight = Math.max(500, document.body.clientHeight - (bottomArea.bottom - bottomArea.top) - 100);
            if(parcoords != null){
                parcoords.width(canvasAreaWidth).height(canvasAreaHeight);
                reset();
                useAxes();
            }
        }

        document.getElementById('dimx').addEventListener('blur', dimUpdate, false);
        document.getElementById('dimy').addEventListener('blur', dimUpdate, false);
        document.getElementById('dimz').addEventListener('blur', dimUpdate, false);
        document.getElementById('dimx').addEventListener('keydown', dimEneter, false);
        document.getElementById('dimy').addEventListener('keydown', dimEneter, false);
        document.getElementById('dimz').addEventListener('keydown', dimEneter, false);
        function dimUpdate(eve){
            var i = eve.currentTarget.value;
            if(i && !isNaN(i) && i > 0 && issph){
                targetData = convertSPH(data, params);
                reset();
                useAxes();
            }
        }
        function dimEneter(eve){
            if(eve.keyCode === 13){dimUpdate(eve);}
        }
        document.getElementById('lineColor1').addEventListener('change', redraw, false);
        document.getElementById('lineColor2').addEventListener('change', redraw, false);

        // SPH は複数許可、CSV なら単体ファイルしか受け付けない
        // SPH の場合は包含する component の要素数を考慮して合計値が複数になれば描画
        function fileUpload(evt){
            reset();
            if(!evt.target.files && evt.target.files.length < 1){return;}
            var i;
            var fileLength = evt.target.files.length;
            var flg = [], files = [], fileNames = [], reader = [];
            data = [];
            params = [];
            targetData = null;
            dimensionTitles = {};
            colcount = 0;
            for(i = 0; i < fileLength; ++i){
                files[i] = evt.target.files[i];
                fileNames[i] = files[i].name;
                reader[i] = new FileReader();
                reader[i].onload = (function(index){
                    return function(eve){
                        data[index] = eve.target.result;
                        flg[index] = sph.isBinary(data[index]);
                        if(flg[index]){
                            reader[index].onload = (function(index){
                                return function(eve){
                                    var j, f;
                                    data[index] = eve.target.result;
                                    params[index] = sph.isSPH(data[index]);
                                    params[index].name = fileNames[index];
                                    colcount += params[index].component;
                                    if(params[index]){
                                        f = true;
                                        // load complete check
                                        for(j = 0; j < fileLength; ++j){
                                            f = f && (data[j] !== null && data[j] !== undefined && typeof data[j] === 'object');
                                        }
                                        if(f){
                                            issph = true;
                                            begin();
                                        }
                                    }else{
                                        infoArea('warn', 'csv file be single');
                                        return;
                                    }
                                };
                            })(index);
                            reader[index].readAsArrayBuffer(files[index]);
                        }else{
                            if(index === 0){
                                issph = false;
                                begin();
                            }
                        }
                    };
                })(i);
                reader[i].readAsBinaryString(files[i]);
            }
            function begin(){
                var i, j, k, l, f, g;
                f = true;
                g = flg[0];
                for(i = 1; i < fileLength; ++i){
                    f = f && (g === flg[i]);
                }
                targetData = null;
                if(issph){
                    // type sph
                    if(f && colcount > 1){
                        targetData = convertSPH(data, params);
                        infoArea('samplingdiv', null);
                    }else{
                        infoArea('warn', 'column count error');
                        return;
                    }
                }else{
                    // type csv
                    if(!g && fileLength === 1){
                        targetData = convertCSV(data[0]);
                        infoArea('info', 'csv file');
                    }else{
                        infoArea('warn', 'must be single csv select');
                        return;
                    }
                }
                if(!targetData){
                    infoArea('warn', 'invalid data');
                    return;
                }
                useAxes();
            }
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

        function convertSPH(data, params){
            var temp = [];
            var dest = [];
            var a, i, j, k, l;
            var f = true;
            j = parseInt(document.getElementById('dimx').value, 10);
            if(!j || isNaN(j) || j < 1){j = 100;}
            k = parseInt(document.getElementById('dimy').value, 10);
            if(!k || isNaN(k) || k < 1){k = 100;}
            l = parseInt(document.getElementById('dimz').value, 10);
            if(!l || isNaN(l) || l < 1){l = 100;}
            for(i = 0; i < data.length; ++i){
                params[i].samplingDiv = {x: j, y: k, z: l};
                temp[i] = sph.parse(data[i], params[i]);
            }
            // 要素数が同じかどうかチェック
            for(i = 1, j = temp.length; i < j; ++i){
                f = f && (temp[0].length === temp[i].length);
            }
            if(!f){return null;}

            // minmax をチェック
            dataparam = [];
            j = 0;
            for(i = 0; i < data.length; ++i){
                j += params[i].component;
                if(params[i].component === 1){
                    dimensionTitles[j - 1] = params[i].name;
                    dataparam[j - 1] = {name: dimensionTitles[j - 1], min: params[i].min[0], max: params[i].max[0]};
                }else{
                    dimensionTitles[j - 3] = params[i].name + '_x';
                    dimensionTitles[j - 2] = params[i].name + '_y';
                    dimensionTitles[j - 1] = params[i].name + '_z';
                    dataparam[j - 3] = {name: dimensionTitles[j - 3], min: params[i].min[2], max: params[i].max[2]};
                    dataparam[j - 2] = {name: dimensionTitles[j - 2], min: params[i].min[1], max: params[i].max[1]};
                    dataparam[j - 1] = {name: dimensionTitles[j - 1], min: params[i].min[0], max: params[i].max[0]};
                }
            }

            for(i = 0, j = temp[0].length; i < j; ++i){
                a = [];
                for(k = 0; k < temp.length; ++k){
                    for(l = 0; l < temp[k][i].length; ++l){
                        a.push(temp[k][i][l]);
                    }
                }
                dest.push(a);
            }
            return dest;
        }

        function convertCSV(data){
            var header, temp, dest, rowcell;
            var i, j, k, l, m, n;
            dest = [];
            if(data === null || data === undefined || data === ''){return;}
            temp = data.replace(/ *\n/g, '\n');
            temp = temp.replace(/,\n/g, '\n');
            temp = temp.replace(/,\r\n/g, '\n');
            temp = temp.split('\n');
            if(temp === null || temp === undefined || !temp.length || temp.length < 3){return;}
            header = temp[0].split(',');
            k = true;
            dataparam = [];
            for(i = 0, j = header.length; i < j; ++i){
                k = k && (header[i].match(/^(-|\d|\.)+$/));
                if(!k){break;}
            }
            if(!k){ // use header strings
                for(i = 0, j = header.length; i < j; ++i){
                    dataparam[i] = {name: header[i], min: 0.0, max: 0.0};
                }
                for(i = 1, j = temp.length; i < j; ++i){
                    m = i - 1;
                    dest[m] = {};
                    rowcell = temp[i].split(',');
                    for(l = 0; l < header.length; ++l){
                        n = parseFloat(rowcell[l]);
                        if(isNaN(n)){n = 0.0;}
                        dest[m][header[l]] = n;
                        dataparam[l].min = Math.min(dataparam[l].min, n);
                        dataparam[l].max = Math.max(dataparam[l].max, n);
                    }
                }
            }else{
                for(i = 0, j = header.length; i < j; ++i){
                    dataparam[i] = {name: i, min: 0.0, max: 0.0};
                }
                for(i = 0, j = temp.length; i < j; ++i){
                    dest[i] = {};
                    rowcell = temp[i].split(',');
                    for(l = 0; l < rowcell.length; ++l){
                        n = parseFloat(rowcell[l]);
                        if(isNaN(n)){n = 0.0;}
                        dest[i][l] = n;
                        dataparam[l].min = Math.min(dataparam[l].min, n);
                        dataparam[l].max = Math.max(dataparam[l].max, n);
                    }
                }
            }
            return dest;
        }

        function useAxes(){
            var i, j, k, l;
            if(targetData == null){return;}

            beginDraw(targetData);

            function beginDraw(data){
                if(data.length < 3){
                    infoArea('warn', 'error!');
                    console.log('invalid data:' + data);
                    return;
                }
                dataval = [];
                if(Array.isArray(data[0])){ // csv 先頭行がタイトルではない
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
                // レンダリングのためのパラメータをセット
                setparam();
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

                document.getElementById('glforeground').style.display = '';
                // minmax
                minmaxDOM();
            }
        }

        function minmaxDOM(){
            var i, j, e, f;
            e = document.getElementById('minmax');
            e.innerHTML = '';
            for(i = 0, j = Object.keys(dataparam).length; i < j; ++i){
                f = minmaxRow(i, dataparam[i].name, dataparam[i].min, dataparam[i].max);
                e.appendChild(f);
            }
        }

        function minmaxRow(name, caption, min, max){
            var e = document.createElement('div');
            e.className = 'minmaxRow';
            var f = document.createElement('div');
            f.className = 'caption';
            f.textContent = caption;
            var g = document.createElement('div');
            g.className = 'value';
            g.textContent = 'min: ';
            var i = document.createElement('input');
            i.type = 'number';
            i.value = min;
            i.step = 0.0001;
            i.id = 'min_' + name;
            g.appendChild(i);
            var h = document.createElement('div');
            h.className = 'value';
            h.textContent = 'max: ';
            var j = document.createElement('input');
            j.type = 'number';
            j.value = max;
            j.step = 0.0001;
            j.id = 'max_' + name;
            h.appendChild(j);

            e.appendChild(f);
            e.appendChild(g);
            e.appendChild(h);

            i.addEventListener('blur', inputBlur, false);
            j.addEventListener('blur', inputBlur, false);
            i.addEventListener('keydown', inputEnter, false);
            j.addEventListener('keydown', inputEnter, false);
            return e;
        }

        function inputBlur(eve){
            var e, f, i;
            e = eve.currentTarget;
            i = e.id.replace(/^(min_|max_)/, '');
            e = document.getElementById('min_' + i);
            f = document.getElementById('max_' + i);
            if(e){dataparam[i].min = e.value;}
            if(f){dataparam[i].max = f.value;}
            if(prev.prevType != null){
                reset();
                useAxes();
            }
        }

        function inputEnter(eve){
            if(eve.keyCode === 13){
                eve.currentTarget.blur();
                inputBlur(eve);
            }
        }

        function setparam(){
            usr = {
                logScale: logScale.checked,
                glRender: glRender,
                param: dataparam
            };
            // reset();
        }

        function reset(){
            var e = document.getElementById('example');
            var f = document.getElementById('glforeground');
            if(f){f.style.display = 'none';}
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
                        gl: c.getContext('webgl') || c.getContext('experimental-webgl'),
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
                // brush の選択状態が解除されたように見えてしまうので非表示化しないようにする
                // glContext['glbrush'].gl.viewport(0, 0, width, height);
                // glContext['glbrush'].gl.clearColor(0.0, 0.0, 0.0, 0.0);
                // glContext['glbrush'].gl.clear(glContext['glbrush'].gl.COLOR_BUFFER_BIT);
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

    function infoArea(mode, text){
        var e = document.getElementById('info');
        var f = document.getElementById('samplingdiv');
        switch(mode){
            case 'info':
                e.textContent = text;
                e.style.color = 'white';
                e.style.display = 'block';
                f.style.display = 'none';
                break;
            case 'warn':
                e.textContent = text;
                e.style.color = 'deeppink';
                e.style.display = 'block';
                f.style.display = 'none';
                break;
            case 'samplingdiv':
                e.textContent = '';
                e.style.color = 'white';
                e.style.display = 'none';
                f.style.display = 'block';
                break;
        }
    }

    function zeroPadding(n, c){
        return (new Array(c + 1).join('0') + n).slice(-c);
    }
})(this);

