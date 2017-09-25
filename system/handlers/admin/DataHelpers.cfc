/**
 * Handler that provides admin related helper viewlets,
 * and actions for preside object data
 *
 */
component {

	property name="adminDataViewsService" inject="adminDataViewsService";
	property name="presideObjectService"  inject="presideObjectService";
	/**
	 * Method that is called from `adminDataViewsService.buildViewObjectRecordLink()`
	 * for objects that are managed in the DataManager. Hint: this can also be invoked with:
	 * `event.buildAdminLink( objectName=myObject, recordId=myRecordId )`
	 *
	 */
	private string function getViewRecordLink( required string objectName, required string recordId ) {
		return event.buildAdminLink(
			  linkto      = "datamanager.viewRecord"
			, queryString = "object=#arguments.objectName#&id=#arguments.recordId#"
		);
	}


	/**
	 * Method for rendering a record for an admin view
	 *
	 */
	private string function viewRecord( event, rc, prc, args={} ) {
		var objectName      = args.objectName ?: "";
		var recordId        = args.recordId   ?: "";
		var renderableProps = adminDataViewsService.listRenderableObjectProperties( objectName );
		var record          = presideObjectService.selectData( objectName=objectName, id=recordId );
		var uriRoot         = presideObjectService.getResourceBundleUriRoot( objectName=objectName );

		args.renderedProps = [];

		for( var propertyName in renderableProps ) {
			var renderedValue = adminDataViewsService.renderField(
				  objectName   = objectName
				, propertyName = propertyName
				, recordId     = recordId
				, value        = record[ propertyName ] ?: ""
			);
			args.renderedProps.append( {
				  objectName    = objectName
				, propertyName  = propertyName
				, propertyTitle = translateResource( uri="#uriRoot#field.#propertyName#.title", defaultValue=translateResource( uri="cms:preside-objects.default.field.#propertyName#.title", defaultValue=propertyName ) )
				, recordId      = recordId
				, value         = record[ propertyName ] ?: ""
				, rendered      = renderedValue
			} );
		}

		return renderView( view="/admin/dataHelpers/viewRecord", args=args );
	}

}