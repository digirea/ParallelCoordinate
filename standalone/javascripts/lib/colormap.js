
function ColorMap(canvas, callback){
    var i, step;
    this.callback = callback;
    this.initial_colormap = [
        {step: 0.0,  color: 'rgb(255,  50,  50)'},
        {step: 0.25, color: 'rgb(200, 255,  50)'},
        {step: 0.5,  color: 'rgb( 50, 255, 200)'},
        {step: 0.75, color: 'rgb(  0,  50, 200)'},
        {step: 1.0,  color: 'rgb(  0,   0,  50)'}
    ];
    this.color_map = canvas;
    this.context = this.color_map.getContext("2d"),
    this.width = 30;
    this.height = 256 + 10;
    this.color_steps = this.initial_colormap;
    this.grad_param = {
        grad_width : 18,
        grad_height : 256,
        width : 35,
        height : 256 + 10,
        padding : 5
    };
    this.dragging_step = null,

    this.color_map.width = this.width;
    this.color_map.height = this.height;
    // 初回描画
    this.draw_color_map(this.context, this.grad_param, this.color_steps);

    // マウス位置にあるstepを探してインデックスを返す.
    this. pick_step = function(e){
        var rect = this.color_map.getBoundingClientRect(),
            px = e.clientX - rect.left,
            py = e.clientY - rect.top,
            arrow = {},
            setting_step;
        for (i = 0; i < this.color_steps.length; i = i + 1) {
            step = this.color_steps[i].step;
            arrow.x = 0;
            arrow.y = step * this.grad_param.grad_height - (this.grad_param.padding + 2);
            arrow.w = this.grad_param.width;
            arrow.h =  (this.grad_param.padding + 2) * 2;
            if (arrow.x < px && px < (arrow.x + arrow.w) &&
                arrow.y < py && py < (Math.max(arrow.y, 0) + arrow.h)) {
                    return i;
                }
        }
        return -1;
    };
    this.pick_step.bind(this);

    this.color_map.addEventListener('dblclick', (function(e){
        var picker = document.getElementById('colorpicker'),
            step_index = this.pick_step(e);
        picker.jscolor.show();
        picker.jscolor.onFineChange = (function () {
            this.color_steps[step_index].color = picker.jscolor.toRGBString();
            this.draw_color_map(this.context, this.grad_param, this.color_steps);
            this.send_colormap_change_event(this.color_steps);
        }).bind(this);
    }).bind(this));

    this.color_map.addEventListener('mousedown', (function(e){
        var rect = this.color_map.getBoundingClientRect(),
            px = e.clientX - rect.left,
            py = e.clientY - rect.top,
            deleting_step,
            step_index = this.pick_step(e);

        if(step_index >= 0){
            if(e.button === 0){
                // 左クリック(移動開始)
                this.dragging_step = this.color_steps[i];
            }else{
                // 右クリックなど(削除)
                deleting_step = this.color_steps[i];
                this.delete_color_map_step(this.context, this.grad_param, this.color_steps, i);
                return;
            }
        }

        // 新規追加
        if(!this.dragging_step && !deleting_step){
            var step = Math.min(Math.max(py / this.grad_param.grad_height, 0.0), 1.0);
            this.color_steps.push({ step : step, color : "rgb(255, 255, 255)"});
            this.draw_color_map(this.context, this.grad_param, this.color_steps);
            this.dragging_step = this.color_steps[this.color_steps.length - 1];
            this.send_colormap_change_event(this.color_steps);
        }
    }).bind(this));
    window.addEventListener('mousemove', (function(e){
        var rect = this.color_map.getBoundingClientRect(),
            px = e.clientX - rect.left,
            py = e.clientY - rect.top;
        if(this.dragging_step){
            this.dragging_step.step = Math.min(Math.max(py / this.grad_param.grad_height, 0.0), 1.0); // clamp
            this.draw_color_map(this.context, this.grad_param, this.color_steps);
        }
    }).bind(this));
    window.addEventListener('mouseup', (function(){
        if(this.dragging_step){
            this.dragging_step = null;
            this.send_colormap_change_event(this.color_steps);
        }
    }).bind(this));

    // 初回に1回イベントを投げる。
    this.send_colormap_change_event(this.color_steps);
}

ColorMap.prototype.send_colormap_change_event = function(color_steps){
    var c = this.get_colormap_rgba(color_steps, 256, 1);
    this.callback(c);
};

ColorMap.prototype.draw_color_map = function(context, grad_param, color_steps){
    var i;
    var grad_width = grad_param.grad_width,
        grad_height = grad_param.grad_height,
        width = grad_param.width,
        height = grad_param.height,
        padding = grad_param.padding,
        grad,
        i,
        step;

    context.clearRect(0, 0, width, height);

    grad  = context.createLinearGradient(0, 0, 0, height);
    for(i = 0; i < color_steps.length; i = i + 1){
        grad.addColorStop(color_steps[i].step, color_steps[i].color);
    }
    context.fillStyle = grad;
    context.beginPath();
    context.fillRect(0, padding, grad_width, grad_height);
    context.closePath();

    context.lineWidth = 1.0;
    context.strokeStyle = 'gray';
    for(i = 0; i < color_steps.length; i = i + 1){
        step = color_steps[i].step;
        context.beginPath();
        context.moveTo(grad_width, step * grad_height + padding);
        context.lineTo(grad_width + 5, step * grad_height);
        context.lineTo(width, step * grad_height);
        context.lineTo(width, step * grad_height + padding * 2);
        context.lineTo(grad_width + 5, step * grad_height + padding * 2);
        context.lineTo(grad_width, step * grad_height + padding);
        context.closePath();
        context.fill();
        context.stroke();
    }
};

ColorMap.prototype.delete_color_map_step = function(context, grad_param, color_steps, step_index){
    color_steps.splice(step_index, 1);
    this.draw_color_map(context, grad_param, color_steps);
    this.send_colormap_change_event(color_steps);
};

ColorMap.prototype.get_colormap_rgba = function(color_steps, width, height){
    var i,
        grad,
        dummy_canvas = document.createElement('canvas'),
        context = dummy_canvas.getContext("2d");
    dummy_canvas.width = width;
    dummy_canvas.height = height;
    context.clearRect(0, 0, width, height);
    grad = context.createLinearGradient(0, 0, width, 0);
    for(i = 0; i < color_steps.length; i = i + 1){
        grad.addColorStop(1.0 - color_steps[i].step, color_steps[i].color);
    }
    context.fillStyle = grad;
    context.beginPath();
    context.fillRect(0, 0, width, height);
    context.closePath();
    context.fill();
    return {
        canvas: dummy_canvas,
        context: context,
        imageData: context.getImageData(0, 0, width, height).data
    };
    // return context.getImageData(0, 0, width, height).data;
};

