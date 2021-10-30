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

    const countSplinePoints = document.getElementById("countSplinePoints");
    // const equallySpaced = document.getElementById("equallySpaced");
    // const chordLength = document.getElementById("chordLength");
    // const centripetalMethod = document.getElementById("centripetalMethod");
	let splineDegree =  document.getElementById("splineDegree");
	let delta =  document.getElementById("delta");
    Data.init(gl, countSplinePoints,splineDegree,delta);

    // Register function (event handler) to be called on a mouse press
    canvas.onclick = function (ev) { click(ev, canvas); };

    canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

    canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

    canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

    const lineSpline = document.getElementById("chkLineSpline");
	const approxPolySpline = document.getElementById("ApproxPolySpline")
    const brokenLine = document.getElementById("chkBrokenLine");
    const visualizeSplineWithPoints = document.getElementById("chkVisualizeWithPoints");
    const visualizeSplineWithLines = document.getElementById("chkVisualizeWithLine");

    lineSpline.onclick = function () { Data.plotMode(1); };
	approxPolySpline.onclick = function () { Data.plotMode(6); };
    countSplinePoints.onchange = function () { Data.plotMode(2); };
	delta.onchange = function () { Data.plotMode(7); };
    // equallySpaced.onclick = function () { Data.plotMode(2); };
    // chordLength.onclick = function () { Data.plotMode(2); };
    // centripetalMethod.onclick = function () { Data.plotMode(2); };
    brokenLine.onclick = function () { Data.plotMode(3); };
    visualizeSplineWithPoints.onclick = function () { Data.plotMode(4); };
    visualizeSplineWithLines.onclick = function () { Data.plotMode(5); };

    // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT);
}

class Point {
    constructor(x, y) {
        this.select = false;
        this.x = x;
        this.y = y;
		this.t = 0
		this.h = 1;
        this.setRect();
    }
    setPoint(x, y) {
        this.x = x;
        this.y = y;
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
	pointsApprox: [],
    countAttribData: 3, //x,y,sel
    verticesCtr: {},
    verticesSpline: {},
	verticesApprox: {},
    FSIZE: 0,
    gl: null,
    vertexBufferCtr: null,
    vertexBufferSpline: null,
	vertexBufferApprox: null,
    a_Position: -1,
    a_select: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    movePoint: false,
    iMove: -1,
    leftButtonDown: false,
    drawBrokenLine: false,
    drawLineSpline: false,
	drawApproxSpline: false,
    visualizeSplineWithPoints: true,
    visualizeSplineWithLine: false,
    countSplinePoints: null,
	splineDegree: null,
	delta: null,
    equallySpaced: null,
    chordLength: null,
    centripetalMethod: null,
    init: function (gl, countSplinePoints, splineDegree,delta) {
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
		this.vertexBufferApprox = this.gl.createBuffer();
        if (!this.vertexBufferApprox) {
            console.log('Failed to create the buffer object for spline points');
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

        this.countSplinePoints = countSplinePoints;
		this.splineDegree = splineDegree
		this.delta = delta
       
    },
    setLeftButtonDown: function (value) {
        this.leftButtonDown = value;
    },
    add_coords: function (x, y) {
        const pt = new Point(x, y);
        this.pointsCtr.push(pt);
        this.add_vertices();
    },
	
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            if (this.movePoint) {
                this.pointsCtr[this.iMove].setPoint(x, y);

                this.verticesCtr[this.iMove * this.countAttribData] = this.pointsCtr[this.iMove].x;
                this.verticesCtr[this.iMove * this.countAttribData + 1] = this.pointsCtr[this.iMove].y;

                this.setVertexBuffersAndDraw();

                if (this.drawLineSplines)
                    this.calculateLineSpline();
				if (this.drawApproxSpline)
                    this.calculateApproxSpline();
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
	
    clickHandler: function (x, y) {
        if (!this.movePoint) {
            this.add_coords(x, y);
            if (this.drawLineSplines)
                this.calculateLineSpline();
			if (this.drawApproxSpline)
                this.calculateApproxSpline();
            this.setVertexBuffersAndDraw();
        }
    },
	
    add_vertices: function () {
        this.verticesCtr = new Float32Array(this.pointsCtr.length * this.countAttribData);
        for (let i = 0; i < this.pointsCtr.length; i++) {
            this.verticesCtr[i * this.countAttribData] = this.pointsCtr[i].x;
            this.verticesCtr[i * this.countAttribData + 1] = this.pointsCtr[i].y;
            this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;
        }
        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT;
    },
	
    setVertexBuffersAndDraw: function () {		 
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

        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
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
       if (this.drawLineSplines) {
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
		if (this.drawApproxSpline) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferApprox);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesApprox, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, 0, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);

            this.gl.uniform4f(this.u_color, 1.0, 1.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 7.0);
			this.gl.drawArrays(this.gl.POINTS, 0, this.pointsApprox.length);
            
        }
    },
    plotMode: function (selOption) {
        switch (selOption) {
            case 1:
                this.drawLineSplines = !this.drawLineSplines;
                if (this.drawLineSplines)
                    this.calculateLineSpline();
                break;
            case 2:
                if (this.drawLineSplines)
                    this.calculateLineSpline();
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
                this.drawApproxSpline = !this.drawApproxSpline;
                if (this.drawApproxSpline)
                    this.calculateApproxSpline();
                break;
            case 7:
                if (this.drawApproxSpline)
                    this.calculateApproxSpline();
              break;
        }
        this.setVertexBuffersAndDraw();
    },
    calculateLineSpline: function () {
        let i, j, k;
        let pt;		
        let t, x, y, dt, h;
		let N_am = eval(this.pointsCtr.length)-1
        let basN   = [];
		let knot_vector = [];
        const N = eval(this.countSplinePoints.value);
		const p = eval(this.splineDegree.value);
        this.pointsSpline = new Array(N);
		//генерация вектора узлов
		for (i = 0; i< eval(N_am)+eval(p)+2; i++)
			knot_vector.push(i)

        // РАСЧЕТ КООРДИНАТ ТОЧКИ СПЛАЙНА
		let t_min = knot_vector[p];
		let t_max = knot_vector[knot_vector.length-p-1];
        dt = (t_max - t_min) / (N - 1);
        t = t_min-dt, i = 0;
		for (j=0; j < N; j++){
			t += dt
			if(j == N-1)
				t= t_max 
			k = findSpan(knot_vector.length-p-2, p, t, knot_vector);
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
			this.pointsSpline[j]= pt;
		}
		
        this.verticesSpline = new Float32Array(this.pointsSpline.length * 2);
        for (j = 0; j < this.pointsSpline.length; j++) {

            this.verticesSpline[j * 2] = this.pointsSpline[j].x;
            this.verticesSpline[j * 2 + 1] = this.pointsSpline[j].y;
        }
    },
	
	calculateApproxSpline: function () {
		 // ДОБАВИТЬ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЮ ШАГА ПО ПАРАМЕТРИЧЕСКОЙ КООРДИНАТЕ t ДЛЯ ПОСТРОЕНИЯ СПЛАЙНА
        let i, j,k;
        let pt, r_t, r_tt, normal, rho, delta_t,ii ;
        let t, x, y, h, x_t, y_t, h_t,  x_tt, y_tt, h_tt;
        //генерация вектора узлов
		let knot_vector = [];
		const N = eval(this.countSplinePoints.value);
		const p = eval(this.splineDegree.value);
		let n = eval(this.pointsCtr.length)-1
		for (i = 0; i< eval(n)+eval(p)+2; i++)
			knot_vector.push(i)
		let basN   = [];
        let basN_1 = [];
        let basN_2 = [];

		let t_min = 0.04;
		let t_max = 0.4;
      
		let delta = eval(this. delta.value)
		let p1_x = 0;
		let p1_y = 0;
		let kn_1 = new Array(p-1);
		let kn_2 = new Array(p-1);

        let t_vec = [knot_vector[p]];
        // РАСЧЕТ КООРДИНАТ ТОЧКИ СПЛАЙНА
      
        t = knot_vector[p], i = 0;
        while (t<knot_vector[n+1]){
		
			k = findSpan(knot_vector.length-p-2, p, t, knot_vector);
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
		this.pointsApprox = []
		
		for (j=0; j < t_vec.length; j++){
			t = t_vec[j]
			k = findSpan(knot_vector.length-p-2, p, t, knot_vector);
			if(j ==  t_vec.length-1)
				t = knot_vector[knot_vector.length-p-1];
			
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
			this.pointsApprox.push(pt);
		}
        this.verticesApprox = new Float32Array( this.pointsApprox.length * 2);
        for (j = 0; j < this.pointsApprox.length; j++) {
            this.verticesApprox[j * 2]     = this.pointsApprox[j].x;
            this.verticesApprox[j * 2 + 1] = this.pointsApprox[j].y;
        }
	
	}
}

//алгоритм бинарного поиска индекса k

function findSpan(n,p,t,t_vec){
   if (t == t_vec[n+1])
		return n; 
	else{	
		let low = p;
		let high = n +1;
		let mid = Math.trunc((low + high) / 2);
		while ((t < t_vec[mid]) || (t >= t_vec[mid + 1])) {
			if (t < t_vec[mid])
				high = mid;
			else
				low = mid;
				mid =Math.trunc( (low + high) / 2);
		}
		return mid;
	}
}

//алгоритм для вычисления ненулевых базисных функций

function basisFunc(k,t,p,knot_vector,N){
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



function click(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.clickHandler(x - rect.left, canvas.height - (y - rect.top));
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