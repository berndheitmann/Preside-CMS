( function( $ ){

	var expressionLib        = cfrequest.rulesEngineExpressions         || {}
	  , renderFieldEndpoint  = cfrequest.rulesEngineRenderFieldEndpoint || ""
	  , editFieldEndpoint    = cfrequest.rulesEngineEditFieldEndpoint   || "";

	var RulesEngineCondition = (function() {
		function RulesEngineCondition( $formControl, expressions, $ruleList ) {
			this.$formControl     = $formControl;
			this.$ruleList        = $ruleList;
			this.model            = this.deserialize( this.$formControl.val() );
			this.expressions      = expressions;
			this.fieldRenderCache = {};
			this.selectedIndex    = null;

			this.setupBehaviors();
			this.render();
		}

		RulesEngineCondition.prototype.persistToHiddenField = function() {
			this.$formControl.val( this.serialize() );
		};

		RulesEngineCondition.prototype.serialize = function() {
			return JSON.stringify( this.model );
		};

		RulesEngineCondition.prototype.deserialize = function( initialConditionValue ) {
			if ( this.isValidSerializedCondition( initialConditionValue ) ) {
				try {
					return JSON.parse( initialConditionValue );
				} catch( e ) {}
			}

			return [];
		};

		RulesEngineCondition.prototype.isValidSerializedCondition = function( serializedCondition ) {
			if ( typeof serializedCondition !== "string" ) {
				return false;
			}

			if ( $.trim( serializedCondition ).length === 0 ) {
				return false;
			}

			// TODO: ajax call to validate the json string
			return true;
		};

		RulesEngineCondition.prototype.render = function() {
			var lis, $selectedLi, transformExpressionsToHtmlLis, i, rulesEngineCondition=this;

			transformExpressionsToHtmlLis = function( expressions, depth, index ) {
				var lis             = []
				  , indent          = ( 20 * depth )
				  , liTemplate      = '<li class="rules-engine-condition-builder-expression" style="margin-left:' + indent + 'px"></li>'
				  , actionsTemplate = '<span class="rules-engine-condition-builder-expression-actions"><a class="fa fa-fw fa-trash rules-engine-condition-builder-expression-delete"></a></span>'
				  , $li, $actions, i, liIndex;

				for( i=0; i<expressions.length; i++ ) {
					var isOddRow   = i % 2
					  , expression = expressions[i]
					  , liIndex    = index.concat( [i] );


					if ( isOddRow ) {
						$li = $( liTemplate );
						$li.data( "modelIndex", index.concat([i]) );
						$li.html( '<a class="rules-engine-condition-builder-join-toggle">' + i18n.translateResource( "cms:rulesEngine.join." + expression ) + "</a>" );
						$li.addClass( "rules-engine-condition-builder-expression-join" );
						lis.push( $li );
					} else if ( Array.isArray( expression ) ) {
						lis = lis.concat( transformExpressionsToHtmlLis( expression, depth+1, liIndex ) );
					} else {
						$li = $( liTemplate );
						$li.data( "modelIndex", liIndex );
						$li.html( rulesEngineCondition.renderExpression( expression ) );

						$actions = $( actionsTemplate );
						$li.append( $actions );
						if ( i < expressions.length-1 ) {
							$actions.append( '<a class="fa fa-fw fa-arrow-down rules-engine-condition-builder-expression-move-down"></a>' );
						}
						if ( i ) {
							$actions.append( '<a class="fa fa-fw fa-arrow-up rules-engine-condition-builder-expression-move-up"></a>' );
						}

						if ( rulesEngineCondition.selectedIndex !== null && rulesEngineCondition.selectedIndex.join() === liIndex.join() ) {
							$li.addClass( "selected" );
						}

						lis.push( $li );
					}
				}
				return lis;
			};

			lis = transformExpressionsToHtmlLis( this.model, 0, [] );
			this.$ruleList.html( "" );
			for( i=0; i<lis.length; i++ ) {
				this.$ruleList.append( lis[i] );
				if ( lis[i].hasClass( "selected" ) ) {
					$selectedLi = lis[i];
					$selectedLi.removeClass( "selected" );
				}
			}

			if ( $selectedLi ) {
				this.selectExpression( $selectedLi );
			}
		};

		RulesEngineCondition.prototype.addExpression = function( expressionId ) {
			var newExpression = this.newExpression( expressionId );

			if ( this.model.length ) {
				this.model.push( "and" );
			}
			this.model.push( newExpression );
			this.selectedIndex = [ this.model.length-1 ];

			this.persistToHiddenField();
			this.render();
		};

		RulesEngineCondition.prototype.newExpression = function( expressionId ) {
			var expression = this.getExpression( expressionId )
			  , newExpression;

			if ( expression === null ) {
				return {};
			}

			newExpression = {
				  expression : expression.id
				, fields     : {}
			};

			for( fieldName in expression.fields ){
				if ( typeof expression.fields[ fieldName ].default === "undefined" ) {
					newExpression.fields[ fieldName ] = null;
				} else {
					newExpression.fields[ fieldName ] = expression.fields[ fieldName ].default;
				}
			}

			return newExpression;
		};

		RulesEngineCondition.prototype.getExpression = function( expressionId ) {
			var i, expression;

			for( i=this.expressions.length-1; i>=0; i-- ) {
				expression = this.expressions[ i ];
				if ( expression.id.toLowerCase() === expressionId.toLowerCase() ) {
					return expression;
				}
			}

			return;
		};

		RulesEngineCondition.prototype.renderExpression = function( expression ) {
			var definition = this.getExpression( expression.expression )
			  , text       = definition.text || ""
			  , $expression = $( "<span></span>" )
			  , fieldName, fieldValue, fieldPatternRegex, fieldDefinition, $field;

			if ( typeof definition.id === "undefined" ) {
				return "";
			}

			for( fieldName in expression.fields ) {
				fieldPatternRegex = new RegExp( "\{" + fieldName + "\}", "gi" );
				text = text.replace( fieldPatternRegex, '<span class="rules-engine-condition-builder-field" data-field-name="' + fieldName + '"></span>' );
			}

			$expression.html( text );

			for( fieldName in expression.fields ) {
				fieldValue      = expression.fields[ fieldName ];
				$field          = $expression.find( "[data-field-name=" + fieldName + "]" );

				fieldDefinition = definition.fields[ fieldName ] || {};
				$field.data( "fieldDefinition", fieldDefinition );
				$field.data( "fieldValue", fieldValue );

				this.renderField( fieldName, fieldValue, fieldDefinition, $field );
			}

			return $expression;
		};

		RulesEngineCondition.prototype.renderField = function( fieldName, fieldValue, fieldDefinition, $field ) {
			var cacheKey = JSON.stringify( { fieldName:fieldName, fieldValue:fieldValue, fieldDefinition:fieldDefinition } );

			if ( fieldValue !== null ) {
				$field.addClass( "rules-engine-condition-builder-field-loading" ).html( "&hellip;" );

				if ( !this.fieldRenderCache[ cacheKey ] ) {
					this.fieldRenderCache[ cacheKey ] = $.post( renderFieldEndpoint, $.extend( {}, { fieldValue:fieldValue }, fieldDefinition ) );
				}

				this.fieldRenderCache[ cacheKey ].done( function( response ){
					$field.html( '<a class="rules-engine-condition-builder-field-link">' + response + '</a>' );
				} );
			} else {
				$field.html( '<a class="rules-engine-condition-builder-field-link">' + fieldDefinition.defaultLabel + '</a>' );
			}

			if ( fieldDefinition.fieldType !== "boolean" ) {
				this.setupFieldEditModal( fieldName, fieldValue, fieldDefinition, $field );
			}
		};

		RulesEngineCondition.prototype.setupFieldEditModal = function( fieldName, fieldValue, fieldDefinition, $field ){
			var rulesEngineCondition = this
			  , iframeUrl            = editFieldEndpoint
			  , qsDelim              = ( iframeUrl.search( /\?/ ) == -1 ) ? "?" : "&"
			  , callbacks, modalOptions, iframeModal;

			callbacks = {
				onLoad : function( iframe ) {
					iframe.rulesEngineCondition = rulesEngineCondition;
					iframe.$field = $field;
					iframe.modal  = iframeModal;

					$field.data( "editIframe", iframe );
				},
				onShow : function( modal, iframe ){
					modal.on('hidden.bs.modal', function (e) {
						modal.remove();
					} );
				}
			};

			modalOptions = {
				title     : i18n.translateResource( "cms:rulesEngine.configure.field.modal.title" ),
				className : "full-screen-dialog limited-size",
				buttons   : {
					cancel : {
						  label     : '<i class="fa fa-reply"></i> ' + i18n.translateResource( "cms:cancel.btn" )
						, className : "btn-default"
					},
					ok : {
						  label     : '<i class="fa fa-check"></i> ' + i18n.translateResource( "cms:ok.btn" )
						, className : "btn-primary"
						, callback  : function(){ return rulesEngineCondition.submitFieldDialog( $field ); }
					}
				}
			};

			iframeUrl += qsDelim + $.param( $.extend( {}, { fieldValue:fieldValue }, fieldDefinition ) );
			iframeModal = new PresideIframeModal( iframeUrl, "100%", "100%", callbacks, modalOptions );
			$field.data( "editModal", iframeModal );
		};

		RulesEngineCondition.prototype.saveFieldValue = function( $field, value ){
			var modal           = $field.data( "editIframe" ).modal
			  , $li             = $field.closest( ".rules-engine-condition-builder-expression" )
			  , expressionModel = this.getModelReferenceFromIndex( $li.data( "modelIndex" ) )
			  , fieldName       = $field.data( "fieldName" );

			expressionModel.fields[ fieldName ] = value;
			this.persistToHiddenField();
			this.render();

			modal.close();
		};

		RulesEngineCondition.prototype.submitFieldDialog = function( $field ){
			var editIframe = $field.data( "editIframe" )
			  , savedValue;

			if ( typeof editIframe.rulesEngineDialog !== "undefined" ) {
				editIframe.rulesEngineDialog.submitForm();
				return false;
			}

			return true;
		};

		RulesEngineCondition.prototype.setupBehaviors = function() {
			var rulesEngineCondition = this;

			this.$ruleList.on( "click", ".rules-engine-condition-builder-join-toggle", function( e ){
				e.preventDefault();

				rulesEngineCondition.selectedIndex = null;
				rulesEngineCondition.toggleJoin( $( this ) );
			} );

			this.$ruleList.on( "click", ".rules-engine-condition-builder-expression:not(.rules-engine-condition-builder-expression-join)", function( e ){
				e.preventDefault();

				if ( !$( e.target ).is( "a" ) ) {
					rulesEngineCondition.selectExpression( $( this ) );
				}
			} );

			this.$ruleList.on( "click", ".rules-engine-condition-builder-field-link", function( e ){
				e.preventDefault();
				rulesEngineCondition.selectExpression( $( this ).closest( ".rules-engine-condition-builder-expression" ) );
				rulesEngineCondition.processFieldClick( $( this ) );
			} );

			this.$ruleList.on( "click", ".rules-engine-condition-builder-expression-delete", function( e ){
				e.preventDefault();
				rulesEngineCondition.processDeleteExpressionClick( $( this ) );
			} );

			this.$ruleList.on( "click", ".rules-engine-condition-builder-expression-move-up", function( e ){
				e.preventDefault();
				rulesEngineCondition.processMoveExpressionClick( $( this ), "up" );
			} );
			this.$ruleList.on( "click", ".rules-engine-condition-builder-expression-move-down", function( e ){
				e.preventDefault();
				rulesEngineCondition.processMoveExpressionClick( $( this ), "down" );
			} );
		};

		RulesEngineCondition.prototype.getModelIndexString = function( index ){
			var string = "this.model[", i;

			for( i=0; i<index.length; i++ ) {
				string += index[i];
				if ( i < ( index.length-1 ) ) {
					string += '][';
				}
			}

			string += "]";

			return string;
		};

		RulesEngineCondition.prototype.toggleJoin = function( $clickedJoin ) {
			var $li = $clickedJoin.closest( ".rules-engine-condition-builder-expression" )
			  , modelIndexString, currentValue, newValue;

			if ( $li.length ) {
				modelIndexString = this.getModelIndexString( $li.data( "modelIndex" ) );
				currentValue     = eval( modelIndexString );
				newValue         = currentValue === "and" ? "or" : "and";

				eval( modelIndexString + ' = "' + newValue + '"' );

				this.persistToHiddenField();
				this.render();
			}
		};

		RulesEngineCondition.prototype.processFieldClick = function( $clickedFieldLink ) {
			var $field = $clickedFieldLink.closest( ".rules-engine-condition-builder-field" )
			  , $li, fieldDefinition, fieldName, fieldValue, expressionModel;

			if ( $field.length ) {
				$li = $field.closest( ".rules-engine-condition-builder-expression" );
				expressionModel = this.getModelReferenceFromIndex( $li.data( "modelIndex" ) );

				fieldDefinition = $field.data( "fieldDefinition" );
				fieldName       = $field.data( "fieldName" );
				fieldValue      = $field.data( "fieldValue" );
				fieldType       = fieldDefinition.fieldType;

				if ( fieldType === "boolean" ) {
					expressionModel.fields[ fieldName ] = !expressionModel.fields[ fieldName ];
					this.persistToHiddenField();
					this.render();
				} else {
					$field.data( "editModal" ).open();
				}

			}
		};

		RulesEngineCondition.prototype.processDeleteExpressionClick = function( $clickedLink ) {
			var $li         = $clickedLink.closest( ".rules-engine-condition-builder-expression" )
			  , modelIndex  = $li.data( "modelIndex" );

			this.deleteExpression( modelIndex );
		};

		RulesEngineCondition.prototype.deleteExpression = function( modelIndex ) {
			var listPosition = modelIndex[ modelIndex.length-1 ]
			  , parentIndex, parentList;

			if ( modelIndex.length > 1 ) {
				parentIndex = modelIndex.slice( 0, modelIndex.length-2 )
				parentList  = getModelReferenceFromIndex( parentIndex );
			} else {
				parentList = this.model;
			}

			parentList.splice( listPosition, 1 );
			if ( parentList.length ) {
				if ( listPosition === 0 ) {
					parentList.splice( listPosition, 1 );
				} else {
					parentList.splice( listPosition-1, 1 );
				}
			}

			if ( !parentList.length && modelIndex.length > 1 ) {
				this.deleteExpression( parentIndex );
			}

			this.persistToHiddenField();
			this.render();
		};

		RulesEngineCondition.prototype.getModelReferenceFromIndex = function( index ) {
			return eval( this.getModelIndexString( index ) );
		};

		RulesEngineCondition.prototype.selectExpression = function( $li ){
			var selectedClass = "rules-engine-condition-builder-expression-selected"
			  , hasClass      = $li.hasClass( selectedClass );

			this.$ruleList.find( ".rules-engine-condition-builder-expression" ).removeClass( "rules-engine-condition-builder-expression-selected" );

			if ( !hasClass ) {
				$li.addClass( selectedClass );
				this.selectedIndex = $li.data( "modelIndex" );
			}
		};

		RulesEngineCondition.prototype.processMoveExpressionClick = function( $clickedLink, direction ){
			var $li         = $clickedLink.closest( ".rules-engine-condition-builder-expression" )
			  , modelIndex  = $li.data( "modelIndex" );

			this.moveExpression( modelIndex, direction );
		};

		RulesEngineCondition.prototype.moveExpression = function( modelIndex, direction ) {
			var listPosition = modelIndex[ modelIndex.length-1 ]
			  , swapIndex    = direction == "up" ? ( listPosition - 2 ) : ( listPosition + 2 )
			  , parentIndex, parentList, tmp;

			if ( modelIndex.length > 1 ) {
				parentIndex = modelIndex.slice( 0, modelIndex.length-2 )
				parentList  = getModelReferenceFromIndex( parentIndex );
			} else {
				parentList = this.model;
			}

			if ( swapIndex >= 0 && swapIndex < parentList.length ) {
				tmp = parentList[ swapIndex ];
				parentList[ swapIndex ] = parentList[ listPosition ];
				parentList[ listPosition ] = tmp;

				this.selectedIndex = modelIndex;
				this.selectedIndex[ this.selectedIndex.length-1 ] = swapIndex;

				this.persistToHiddenField();
				this.render();
			}

		};

		return RulesEngineCondition;
	})();

	$.fn.rulesEngineConditionBuilder = function(){
		return this.each( function(){
			var $formControl      = $( this )
			  , $builderContainer = $formControl.next( "div.rules-engine-condition-builder" )
			  , $searchInput      = $builderContainer.find( ".rules-engine-condition-builder-expression-search" )
			  , $expressionList   = $builderContainer.find( ".rules-engine-condition-builder-expressions-list" )
			  , $conditionPanel   = $builderContainer.find( ".rules-engine-condition-builder-condition-pane" )
			  , $ruleList         = $builderContainer.find( ".rules-engine-condition-builder-rule-list" )
			  , $expressions      = $expressionList.find( "> li" )
			  , tabIndex          = $formControl.attr( "tabindex" )
			  , savedCondition    = $formControl.val()
			  , expressions       = expressionLib[ $formControl.attr( "id" ) ] || []
			  , $hiddenControl
			  , condition
			  , performSearch
			  , initializeBuilder
			  , prepareSearchEngine
			  , prepareDragAndDrop
			  , addExpression
			  , sortableStop;

			initializeBuilder = function() {
				var id       = $formControl.attr( "id" )
				  , name     = $formControl.attr( "name" )
				  , tabIndex = $formControl.attr( "tabindex" )
				  , val      = $formControl.val();


				$builderContainer.removeClass( "hide" );
				$searchInput.on( "keyup", performSearch );

				$hiddenControl = $( '<input type="hidden">' );
				$hiddenControl.val( val );
				$hiddenControl.attr( "name", name );
				$formControl.after( $hiddenControl );
				$formControl.remove();
				$hiddenControl.attr( "id", id );

				condition = new RulesEngineCondition( $hiddenControl, expressions, $ruleList );

				prepareSearchEngine();
				prepareDragAndDrop();
			};

			prepareSearchEngine = function(){
				$expressions.each( function(){
					var $expression = $( this );

					$expression.data( "originalText", $expression.text() )
				} );
			};

			performSearch = function() {
				var query = $searchInput.val();

				$expressions.each( function(){
					var $expression    = $( this )
					  , expressionText = $expression.data( "originalText" );

					if ( !query.length ) {
						$expression.removeClass( "hide" );
						$expression.html( expressionText );
					} else {
						if ( expressionText.toLowerCase().includes( query.toLowerCase() ) ) {
							$expression.removeClass( "hide" );
							$expression.html(
								expressionText.replace( new RegExp( query, "gi" ), function( match ){ return "<b>" + match + "</b>" } )
							);
						} else {
							$expression.addClass( "hide" );
						}
					}
				} );

			};

			prepareDragAndDrop = function() {
				$expressions.draggable( { helper : "clone" } );
				$conditionPanel.droppable({
					  accept     : $expressions
		        	, drop       : addExpression
		        	, hoverClass : "ui-droppable-hover"
				});
			};

			addExpression = function( event, ui ){
				var $expression = ui.draggable.clone();
				condition.addExpression( $expression.data( "id" ) );
			};

			sortableStop = function(){

			};

			initializeBuilder();
		} );
	};

	$( "textarea.rules-engine-condition-builder" ).rulesEngineConditionBuilder();

} )( presideJQuery );