// app/src/lib/math/numeric/romberg.js

export const romberg = {
	// nmax = number of partitions, n=2^nmax
	NMAX : 32,
	// maximum absolute approximate error acceptable (should be >=0)
	abs : 1e-10,
	// maximum absolute relative approximate error acceptable (should be >=0)
	rel : 1e-10,

	integrate : function(func, a, b) {
		// INPUTS
		// func=integrand
		// a= lower limit of integration
		// b= upper limit of integration
		// OUTPUTS
		// integ_value= estimated value of integral
		let h = b-a;
		// calculating the value with 1-segment trapezoidal rule
		let rombCurr = [h * (func(a) + func(b)) / 2.];
		
		let integ_val = rombCurr[0];

		for (let idx = 1; idx <= romberg.NMAX; idx++) {
			
			let rombPrev = rombCurr; rombCurr = [];
			// updating the value with double the number of segments
			// by only using the values where they need to be calculated
			h = h / 2.;
			let integ = 0.;
			
			for (let kdx = 1, lim = 2**idx - 1; kdx <= lim; kdx+=2) integ += func(a + kdx*h); 
			
			rombCurr[0] = rombPrev[0] / 2. + integ * h;

			for (let jdx = 1; jdx <= idx; jdx++) {
				// Using Romberg method to calculate next extrapolatable value
				rombCurr[jdx]= rombCurr[jdx-1] + (rombCurr[jdx-1] - rombPrev[jdx-1]) / (4**jdx -1.);
				// Calculating absolute approximate error
				let Ea = Math.abs( rombCurr[jdx] - rombCurr[jdx-1] );
				// Calculating absolute relative approximate error
				let Er = Math.abs( Ea / rombCurr[jdx] ) * 100.;
				// Assigning most recent value to the return variable
				integ_val = rombCurr[jdx];
				// returning the value if either tolerance is met
				if ( Ea < romberg.abs || Er < romberg.rel ) return integ_val; 
			}
		}
		// returning the last calculated value of integral whether tolerance is met or not
		return integ_val;
	},

	integrateFresnel : function(tauFunc, a, b) { 
		// returns \int_a^b e^( i * tauFunc(l) ) dl = \int (cos + i*sin)( tauFunc(l) ) dl in R^2 !!!
		// where l is the input for the angle-resulting function 'tauFunc'
		let h = b-a;
		// calculating the value with 1-segment trapezoidal rule
		let tauA = tauFunc(a), tauB = tauFunc(b);

		let currC = [h * ( Math.cos( tauA ) + Math.cos( tauB ) ) / 2.];
		let currS = [h * ( Math.sin( tauA ) + Math.sin( tauB ) ) / 2.];
		
		let integ_val = { intC: currC[0], intS: currS[0] };

		for (let idx = 1; idx <= romberg.NMAX; idx++) {
			
			let prevC = currC; currC = [];
			let prevS = currS; currS = [];
			// updating the value with double the number of segments
			// by only using the values where they need to be calculated
			h = h / 2.;
			let integC = 0.;
			let integS = 0.;
			
			for (let kdx = 1, lim = 2**idx - 1; kdx <= lim; kdx+=2) { 
				let tau = tauFunc(a + kdx*h);
				integC += Math.cos( tau );
				integS += Math.sin( tau );
			}
			
			currC[0] = prevC[0] / 2. + integC * h;
			currS[0] = prevS[0] / 2. + integS * h;

			for (let jdx = 1; jdx <= idx; jdx++) {
				let dlt = (4**jdx -1.);
				// Using Romberg method to calculate next extrapolatable value
				currC[jdx]= currC[jdx-1] + (currC[jdx-1] - prevC[jdx-1]) / dlt;
				currS[jdx]= currS[jdx-1] + (currS[jdx-1] - prevS[jdx-1]) / dlt;
				// Calculating absolute approximate error
				let EaC = Math.abs( currC[jdx] - currC[jdx-1] );
				let EaS = Math.abs( currS[jdx] - currS[jdx-1] );
				
				// Calculating absolute relative approximate error
				let ErS = Math.abs( EaC / currC[jdx] ) * 100.;
				let ErC = Math.abs( EaS / currS[jdx] ) * 100.;
				
				// Assigning most recent value to the return variable
				integ_val = { intC: currC[jdx], intS: currS[jdx] };
				
				// returning the value if either tolerance is met
				if (EaC < romberg.abs && EaS < romberg.abs) { 
					// console.debug("romberg at " + idx); 
					return integ_val; 
					}
				if (ErC < romberg.rel && ErS < romberg.rel) { 
					// console.debug("romberg at " + idx); 
					return integ_val; 
					}
			}
		}
		// returning the last calculated value of integral whether tolerance is met or not
		console.debug("romberg at " + idx); 
		return integ_val;
	}
}
/* ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ */

// console.log("ufRomberg2023 is loaded");
