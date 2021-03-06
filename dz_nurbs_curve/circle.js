// 1.js

"use strict";

// Vertex shader program
const VSHADER_SOURCE =
    'attribute vec4 a_Position;\n' +
    'attribute float a_select;\n' +
    'uniform mat4 u_projMatrix;\n' +
    'uniform float u_pointSize;\n' +
    'uniform vec4 u_color;\n' +
    'uniform vec4 u_colorSelect;\n' +
    'varying vec4 v_color;\n' +
    'void main() {\n' +
    '  gl_Position = u_projMatrix * a_Position;\n' +
    '  gl_PointSize = u_pointSize;\n' +
    '  if (a_select != 0.0)\n' +
    '    v_color = u_colorSelect;\n' +
    '  else\n' +
    '    v_color = u_color;\n' +
    '}\n';

// Fragment shader program
const FSHADER_SOURCE =
    'precision mediump float;\n' +
    'varying vec4 v_color;\n' +
    'void main() {\n' +
    '  gl_FragColor = v_color;\n' +
    '}\n';

function main() {
    // Retrieve <canvas> element
    const canvas = document.getElementById('webgl');

    // Get the rendering context for WebGL
    const gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    const projMatrix = mat4.ortho(mat4.create(), 0, gl.drawingBufferWidth, 0, gl.drawingBufferHeight, 0, 1);

    // Pass the projection matrix to the vertex shader
    const u_projMatrix = gl.getUniformLocation(gl.program, 'u_projMatrix');
    if (!u_projMatrix) {
        console.log('Failed to get the storage location of u_projMatrix');
        return;
    }
    gl.uniformMatrix4fv(u_projMatrix, false, projMatrix);

    const delta = document.getElementById("delta");
    const countSplinePoints = document.getElementById("countSplinePoints");
    const x0 = document.getElementById("x0");
    const y0 = document.getElementById("y0");
    const radius = document.getElementById("radius");

    // Register function (event handler) to be called on a mouse press
    canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

    canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

    canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

    const spline = document.getElementById("chkSpline");
    const brokenLine = document.getElementById("chkBrokenLine");
    const visualizeSplineWithPoints = document.getElementById("chkVisualizeWithPoints");
    const visualizeSplineWithLines = document.getElementById("chkVisualizeWithLine");

    const showCircle = document.getElementById("chkCircle");

    spline.onclick = function () { Data.plotMode(1); };
    countSplinePoints.onchange = function () { Data.plotMode(8); };
    brokenLine.onclick = function () { Data.plotMode(3); };
    visualizeSplineWithPoints.onclick = function () { Data.plotMode(4); };
    visualizeSplineWithLines.onclick = function () { Data.plotMode(5); };
    x0.onchange = function () { Data.plotMode(6); };
    y0.onchange = function () { Data.plotMode(6); };
    radius.onchange = function () { Data.plotMode(6); };
    delta.onchange = function () { Data.plotMode(2); };
    showCircle.onclick = function () { Data.plotMode(7); };

    // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT);

    Data.init(gl, x0, y0, radius, delta, countSplinePoints);
}

class Point {
    constructor(x, y) {
        this.select = false;
        this.h = 1;
        this.x = x;
        this.y = y;
        this.setRect();
    }
    setPoint(x, y, h) {
        this.x = x;
        this.y = y;
        if (h != undefined)
            this.h = h;
        this.setRect();
    }
    setRect() {
        this.left = this.x - 5;
        this.right = this.x + 5;
        this.bottom = this.y - 5;
        this.up = this.y + 5;
    }
    ptInRect(x, y) {
        const inX = this.left <= x && x <= this.right;
        const inY = this.bottom <= y && y <= this.up;
        return inX && inY;
    }
}

const Data = {
    pointsCtr: [],
    pointsSpline: [],
    pointsCircle: [],
    countAttribData: 3, //x,y,sel
    verticesCtr: {},
    verticesSpline: {},
    verticesCircle: {},
    FSIZE: 0,
    gl: null,
    vertexBufferCtr: null,
    vertexBufferSpline: null,
    vertexBufferCircle: null,
    a_Position: -1,
    a_select: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    movePoint: false,
    iMove: -1,
    leftButtonDown: false,
    drawBrokenLine: false,
    drawSpline: false,
    drawCirclePoints: true,
    visualizeSplineWithPoints: true,
    visualizeSplineWithLine: false,
    countCtrPoints: 0,
    countSplinePoints: null,
    delta: null,
    radius: null,
    x0: null,
    y0: null,
    init: function (gl, x0, y0, radius, delta, countSplinePoints) {
        this.gl = gl;
        // Create a buffer object
        this.vertexBufferCtr = this.gl.createBuffer();
        if (!this.vertexBufferCtr) {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }
        this.vertexBufferSpline = this.gl.createBuffer();
        if (!this.vertexBufferSpline) {
            console.log('Failed to create the buffer object for spline points');
            return -1;
        }
        this.vertexBufferCircle = this.gl.createBuffer();
        if (!this.vertexBufferCircle) {
            console.log('Failed to create the buffer object for circle points');
            return -1;
        }

        this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
        if (this.a_Position < 0) {
            console.log('Failed to get the storage location of a_Position');
            return -1;
        }

        this.a_select = this.gl.getAttribLocation(this.gl.program, 'a_select');
        if (this.a_select < 0) {
            console.log('Failed to get the storage location of a_select');
            return -1;
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, 'u_color');
        if (!this.u_color) {
            console.log('Failed to get u_color variable');
            return;
        }

        // Get the storage location of u_colorSelect
        this.u_colorSelect = gl.getUniformLocation(this.gl.program, 'u_colorSelect');
        if (!this.u_colorSelect) {
            console.log('Failed to get u_colorSelect variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, 'u_pointSize');
        if (!this.u_pointSize) {
            console.log('Failed to get u_pointSize variable');
            return;
        }

        // ÇÀÄÀÒÜ ÊÎËÈ×ÅÑÒÂÎ ÊÎÍÒÐÎËÜÍÛÕ ÒÎ×ÅÊ
 
        this.countCtrPoints = 7;

        this.delta = delta;
        this.countSplinePoints = countSplinePoints;
        this.x0 = x0;
        this.y0 = y0;
        this.radius = radius;

        this.setCountCtrPoints();
    },
    setLeftButtonDown: function (value) {
        this.leftButtonDown = value;
    },
    setCountCtrPoints: function () {
        this.pointsCtr = new Array(this.countCtrPoints);
        for (let i = 0; i < this.countCtrPoints; i++)
            this.pointsCtr[i] = new Point(0, 0);

        this.setCtrPoints();
    },
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            if (this.movePoint) {
                this.pointsCtr[this.iMove].setPoint(x, y);

                this.verticesCtr[this.iMove * this.countAttribData] = this.pointsCtr[this.iMove].x;
                this.verticesCtr[this.iMove * this.countAttribData + 1] = this.pointsCtr[this.iMove].y;

                this.setVertexBuffersAndDraw();

                if (this.drawSpline)
                    this.calculateSpline();
            }
        }
        else
            for (let i = 0; i < this.pointsCtr.length; i++) {
                this.pointsCtr[i].select = false;

                if (this.pointsCtr[i].ptInRect(x, y))
                    this.pointsCtr[i].select = true;

                this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;

                this.setVertexBuffersAndDraw();
            }
    },
    mousedownHandler: function (button, x, y) {

        if (button == 0) { //left button
            this.movePoint = false;

            for (let i = 0; i < this.pointsCtr.length; i++) {
                if (this.pointsCtr[i].select == true) {
                    this.movePoint = true;
                    this.iMove = i;
                }
            }

            this.setLeftButtonDown(true);
        }
    },
    mouseupHandler: function (button, x, y) {
        if (button == 0) //left button
            this.setLeftButtonDown(false);
    },
    setVertices: function () {
        this.verticesCtr = new Float32Array(this.pointsCtr.length * this.countAttribData);
        for (let i = 0; i < this.pointsCtr.length; i++) {
            this.verticesCtr[i * this.countAttribData] = this.pointsCtr[i].x;
            this.verticesCtr[i * this.countAttribData + 1] = this.pointsCtr[i].y;
            this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;
        }
        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT;
    },
    setVertexBuffersAndDraw: function () {
        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (this.drawCirclePoints) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCircle);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCircle, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, 0, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);


            this.gl.uniform4f(this.u_color, 0.0, 0.0, 1.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 10.0);

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsCircle.length);
        }

        if (this.pointsCtr.length == 0)
            return;

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCtr);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCtr, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * 3, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Assign the buffer object to a_select variable
        this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * 3, this.FSIZE * 2);
        // Enable the assignment to a_select variable
        this.gl.enableVertexAttribArray(this.a_select);

        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
        this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);
        this.gl.uniform1f(this.u_pointSize, 10.0);
        // Draw
        this.gl.drawArrays(this.gl.POINTS, 0, this.pointsCtr.length);
        if (this.drawBrokenLine) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.0, 0.0, 0.0, 1.0);

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsCtr.length);
        }
        if (this.drawSpline) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSpline);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesSpline, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, 0, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 7.0);

            if (this.visualizeSplineWithPoints)
                this.gl.drawArrays(this.gl.POINTS, 0, this.pointsSpline.length);

            if (this.visualizeSplineWithLine)
                this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsSpline.length);
        }
    },
    plotMode: function (selOption) {
        switch (selOption) {
            case 1:
                this.drawSpline = !this.drawSpline;
                if (this.drawSpline)
                    this.calculateSpline();
                break;
            case 2:
                if (this.drawSpline)
                    this.calculateSpline();
                break;
            case 3:
                this.drawBrokenLine = !this.drawBrokenLine;
                break;
            case 4:
                this.visualizeSplineWithPoints = !this.visualizeSplineWithPoints;
                break;
            case 5:
                this.visualizeSplineWithLine = !this.visualizeSplineWithLine;
                break;
            case 6:
                this.setCtrPoints();
                if (this.drawSpline)
                    this.calculateSpline();
                break;
            case 7:
                this.drawCirclePoints = !this.drawCirclePoints;
                if (this.drawCirclePoints)
                    this.calculateCirclePoints();
                break;
            case 8:
                if (this.drawCirclePoints)
                    this.calculateCirclePoints();
                break;
        }
        this.setVertexBuffersAndDraw();
    },
    setCtrPoints: function () {
        const x0 = parseInt(this.x0.value);
        const y0 = parseInt(this.y0.value);
        const r = parseInt(this.radius.value);

       // ЗАДАТЬ КООРДИНАТЫ КОНТРОЛЬНЫХ ТОЧЕК
	   //1/2 и 1-веса=h
        this.pointsCtr[0].setPoint(x0 + r, y0, 1);
        this.pointsCtr[1].setPoint(x0 + r, y0 + r, 1/2);
        this.pointsCtr[2].setPoint(x0 - r, y0 + r, 1/2);
        this.pointsCtr[3].setPoint(x0 - r, y0, 1);
        this.pointsCtr[4].setPoint(x0 - r, y0 - r, 1/2);
        this.pointsCtr[5].setPoint(x0 + r, y0 - r, 1/2);
        this.pointsCtr[6].setPoint(x0 + r, y0, 1);


        this.setVertices();

        if (this.drawCirclePoints)
            this.calculateCirclePoints();

        this.setVertexBuffersAndDraw();
    },
    calculateSpline: function () {
        // ДОБАВИТЬ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЮ ШАГА ПО ПАРАМЕТРИЧЕСКОЙ КООРДИНАТЕ t ДЛЯ ПОСТРОЕНИЯ СПЛАЙНА
        let i, j;
        let pt, r_t, r_tt, normal, rho, delta_t,ii ;
        let t, x, y, h, x_t, y_t, h_t,  x_tt, y_tt, h_tt;
        let knot_vector = [0,0,0,1,2,2,3,4,4,4]
		let basN   = [];
        let basN_1 = [];
        let basN_2 = [];

		let t_min = 0.04;
		let t_max = 0.4;
        const N = this.countSplinePoints.value;
        this.pointsSpline = [];

        let t_vec = [0];
        // РАСЧЕТ КООРДИНАТ ТОЧКИ СПЛАЙНА
        let k;
        let p;
		let n;
		i=0;
		while (knot_vector[i]== knot_vector[0] )i++;
        p=i-1; 
		j=0;
		while (knot_vector[j]!=null)j++;
		n=j-p-1;
		
		let delta = eval(this. delta.value)
		let p1_x = 0;
		let p1_y = 0;
		let kn_1 = new Array(p-1);
		let kn_2 = new Array(p-1);
				
        t = knot_vector[0], i = 0;
        while (t<knot_vector[n+1]){
			k = findSpan(this.pointsCtr.length, p, t, knot_vector);
            basisFunc(k,t,p,knot_vector,basN);
			x = 0
			y = 0
			x_t = 0
			y_t = 0
			x_tt = 0
			y_tt = 0
			h = 0
			h_t = 0
			h_tt = 0
			
			for(i = 0; i< p+1; i++){		
				x += basN[i]*this.pointsCtr[k-p+i].x*this.pointsCtr[k-p+i].h;
				y += basN[i]*this.pointsCtr[k-p+i].y*this.pointsCtr[k-p+i].h;						
				h += basN[i]*this.pointsCtr[k-p+i].h
			}
			
			//вычислим первую производную
            basisFunc(k,t,p-1,knot_vector,basN_1);
			for(i = 0; i< p; i++){
			//вычислим  первую производную числителя
				p1_x = p*(this.pointsCtr[k-p+1+i].x*this.pointsCtr[k-p+1+i].h - this.pointsCtr[k-p+i].x*this.pointsCtr[k-p+i].h) / (knot_vector[k+1+i] - knot_vector[k-p+i+1]);
				p1_y = p*(this.pointsCtr[k-p+1+i].y*this.pointsCtr[k-p+1+i].h - this.pointsCtr[k-p+i].y*this.pointsCtr[k-p+i].h) / (knot_vector[k+1+i] - knot_vector[k-p+i+1]);
				x_t += basN_1[i]*p1_x ;
				y_t += basN_1[i]*p1_y;
				pt = new Point(p1_x, p1_y);
				kn_1[i] = pt;		
			//вычислим  первую производную знаменателя
				kn_2[i] = p*(this.pointsCtr[k-p+1+i].h - this.pointsCtr[k-p+i].h) / (knot_vector[k+1+i] - knot_vector[k-p+i+1])
				h_t += basN_1[i]*kn_2[i]	
			}
			
			basisFunc(k,t,p-2,knot_vector,basN_2);
			for(i = 0; i< p-1; i++){
			//вычислим  вторую производную числителя(изначального)
				x_tt += basN_2[i] * (p-1) * (kn_1[i+1].x-kn_1[i].x) / (knot_vector[k+i+1] - knot_vector[k-p+i+1+1]);
				y_tt += basN_2[i] * (p-1) * (kn_1[i+1].y-kn_1[i].y) / (knot_vector[k+i+1] - knot_vector[k-p+i+1+1]);
			//вычислим  2ю производную знаменателя(изначального)
				h_tt += basN_2[i] * (p-1) * (kn_2[i+1]-kn_2[i]) / (knot_vector[k+i+1] - knot_vector[k-p+i+1+1]);
			}
			//первая  и вторая производная в точке вычисляется как прроизводная сложной функции
            x_tt = (x_tt * h - h_t * x_t)/(h * h) - ((x_t * h_t + x * h_tt) * (h * h) - 2 * h * h_t * x * h_t)/(h*h*h*h)
			y_tt = (y_tt * h - h_t * y_t)/(h * h) - ((y_t * h_t + y * h_tt) * (h * h) - 2 * h * h_t * y * h_t)/(h*h*h*h)
			
			x_t = (x_t * h - x * h_t) / (h * h)
			y_t = (y_t * h - y * h_t) / (h * h)
		
			r_t    = vec3.fromValues(x_t, y_t, 0);
			r_tt   = vec3.fromValues(x_tt, y_tt, 0);
			normal = vec3.create();
			vec3.cross(normal, r_t, r_tt);

			//вычисление радиуса кривизны и адаптивного шага
			rho     = vec3.len(r_t) * vec3.len(r_t) * vec3.len(r_t) / vec3.len(normal);	
			delta_t = (2 * Math.sqrt(delta * (2 * rho - delta))) / (vec3.len(r_t))
            ii      = t_vec.length-1
			
			//проверка размера адаптивного шага
			if (delta_t < t_min)
				delta_t = t_min;
			if (delta_t > t_max)
				delta_t = t_max;
			if (t_vec[ii] + delta_t > knot_vector[n+1])
				t_vec.push(knot_vector[n+1] + 0.0)
			else 
				t_vec.push(t_vec[ii] + delta_t)
			
            t += delta_t;    
        }
		console.log(t_vec)
		for (j=0; j < t_vec.length; j++){
			t = t_vec[j]
			k = findSpan(this.pointsCtr.length, p, t, knot_vector);
			if(j ==  t_vec.length-1)
				k -= 1;
            basisFunc(k,t,p,knot_vector,basN);
			x = 0
			y = 0
			h = 0
			for(i = 0; i< p+1; i++){
				x += basN[i] * this.pointsCtr[k-p+i].x * this.pointsCtr[k-p+i].h;
				y += basN[i] * this.pointsCtr[k-p+i].y * this.pointsCtr[k-p+i].h;
				h += basN[i] * this.pointsCtr[k-p+i].h
			}
			x  = x/h
			y  = y/h
			pt = new Point(x, y);
			this.pointsSpline.push(pt);
		}
        this.verticesSpline = new Float32Array( this.pointsSpline.length * 2);
        for (j = 0; j < this.pointsSpline.length; j++) {
            this.verticesSpline[j * 2]     = this.pointsSpline[j].x;
            this.verticesSpline[j * 2 + 1] = this.pointsSpline[j].y;
        }
    },
    calculateCirclePoints: function () {
        // let pt;
        // let i;
        // let phi, x, y, dPhi;

        // const x0 = parseInt(this.x0.value);
        // const y0 = parseInt(this.y0.value);
        // const r = parseInt(this.radius.value);

        // const N = this.delta.value;
        // this.pointsCircle = new Array(N);

        // dPhi = 2.0 * Math.PI / (N - 1);
        // phi = 0;

        // for (i = 0; i < N; i++) {
            // x = x0 + r * Math.cos(phi);
            // y = y0 + r * Math.sin(phi);
            // pt = new Point(x, y);

            // phi += dPhi;

            // this.pointsCircle[i] = pt;
        // }
		let i, j;
        let pt;
        let t, x, y, h, dt;
        let knot_vector = [0,0,0,1,2,2,3,4,4,4]
        let basN = [];
        let basR = [];

        const N = this.countSplinePoints.value;
        this.pointsCircle = new Array(N);

        // РАСЧЕТ КООРДИНАТ ТОЧКИ СПЛАЙНА
        let k;
        let p;
		let n;
		i=0;
		while (knot_vector[i]== knot_vector[0] )i++;
        p=i-1; 
		j=0;
		while (knot_vector[j]!=null)j++;
		n=j-p-1;
		
		let t_min = knot_vector[p];
		let t_max =knot_vector[n+1];
        dt = (t_max - t_min) / (N - 1);
        t = knot_vector[0], i = 0;
        for (j = 0; j < N - 1; ++j) {
            k = findSpan(this.pointsCtr.length, p, t, knot_vector);
            basisFunc(k,t,p,knot_vector,basN);
            h = basN[0]*this.pointsCtr[k-2].h + basN[1]*this.pointsCtr[k-1].h + basN[2]*this.pointsCtr[k].h
            basR[0] = basN[0]*this.pointsCtr[k-2].h / h
            basR[1] = basN[1]*this.pointsCtr[k-1].h / h
            basR[2] = basN[2]*this.pointsCtr[k].h / h
			// для конкретного t будет p+1 ненулевых слагаемых=3
            x = basR[0]*this.pointsCtr[k-2].x + basR[1]*this.pointsCtr[k-1].x + basR[2]*this.pointsCtr[k].x;
            y = basR[0]*this.pointsCtr[k-2].y + basR[1]*this.pointsCtr[k-1].y + basR[2]*this.pointsCtr[k].y;
            pt = new Point(x, y);
			//pt - временная переменная для записи туда новой точки, this.pointsSpline[j] = pt - здесь мы эту точку записываем в массив точек сплайна
            this.pointsCircle[j] = pt;
            t += dt;
            if (t > knot_vector[i+1]&& (i < this.pointsCtr.length - 1)) {
                i++;
            }
        }
        x = this.pointsCtr[this.pointsCtr.length - 1].x;
        y = this.pointsCtr[this.pointsCtr.length - 1].y;
        pt = new Point(x, y);
        this.pointsCircle[N - 1] = pt;

		this.verticesCircle = new Float32Array(N * 2);

        for (i = 0; i < N; i++) {
            this.verticesCircle[i * 2] = this.pointsCircle[i].x;
            this.verticesCircle[i * 2 + 1] = this.pointsCircle[i].y;
        }
        
    }
}

function mousedown(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousedownHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mouseup(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mouseupHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mousemove(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();
    //if (ev.buttons == 1)
    //    alert('with left key');
    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top));
}
// индекс k в векторе узлов, при котором выполняется соотношение tk <= t <= tk+1.
//алгоритм бинарного поиска индекса k
function findSpan(n,p,t,knot_vector)
{
    if (t == knot_vector[n + 1])
    {
        return n; /* Special case */
    }
    /* Do binary search */
    let low = p; 
    let high = n + 1;
    let mid = Math.trunc((low + high) / 2);
    while ((t < knot_vector[mid]) || (t >= knot_vector[mid + 1])) {
        if (t < knot_vector[mid])
            high = mid;
        else
            low = mid;
            mid = Math.trunc((low + high) / 2);
    }
    return mid;
}
//алгоритм для вычисления ненулевых базисных функций
function basisFunc(k,t,p,knot_vector,N)
{
    N[0] = 1.0;
    let left = [], right = [], saved;
    for (let j = 1; j <= p; j++) {
        left[j] = t - knot_vector[k + 1 - j];
        right[j] = knot_vector[k + j] - t;
        saved = 0.0;
        for (let r = 0; r < j; r++) {
            let temp = N[r]/(right[r+1]+left[j-r]);
            N[r] = saved + right[r+1]*temp;
            saved = left[j-r]*temp;
        }
        N[j] = saved;
    }
}
