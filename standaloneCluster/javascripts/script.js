
(function(global){
    'use strict';

    var parallel = null;

    // window onload and json import
    window.addEventListener('load', function(){
        // resize event
        window.addEventListener('resize', function(){
            parallel.resetAxis.bind(parallel)();
        }, false);

        // line width change on keydown
        window.addEventListener('keydown', function(eve){
            if(parallel && parallel.glReady){
                switch(eve.keyCode){
                    case 38: // up
                        lineScale = Math.min(20.0, lineScale + 0.2);
                        break;
                    case 40: // down
                        lineScale = Math.max(1.0, lineScale - 0.2);
                        break;
                }
                // redraw
                parallel.drawCanvas();
            }
        }, false);

        // json import
        loadJSON('testdata.json', init);
    }, false);

    // global initialize
    function init(data){
        var json = JSON.parse(data);
        var i, j;

        // check the data
        if(!json || !json.hasOwnProperty('axis') || json.axis.length < 2){
            console.log('invalid data');
            console.log(json);
            return;
        }

        // parallel initialize
        parallel = new ParallelCoordinate(document.getElementById('wrap'));
        // parallel = new ParallelCoordinate(document.getElementById('wrap'), {
        //     padding: 100,
        //     svg: {
        //         defaultwidth: 30,
        //         textbaseline: 200,
        //         textsize: '32px',
        //         scalesize: '20px'
        //     },
        //     axis: {
        //         linewidth: 5,
        //         linecolor: 'crimson',
        //         scalewidth: 1
        //     },
        //     bezier: {
        //         division: 30,
        //         linescale: 20
        //     }
        // });

        // axis initialize
        for(i = 0, j = json.axis.length; i < j; ++i){
            parallel.addAxis(json.axis[i], i);
        }
        parallel.resetAxis();

        // draw canvas
        if(!parallel.glReady){return;}
        parallel.drawCanvas();
    }
})(this);

